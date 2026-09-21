create extension if not exists pgcrypto;

create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    username text not null unique,
    created_at timestamptz not null default now()
);

create table if not exists public.wallets (
    user_id uuid primary key references auth.users(id) on delete cascade,
    balance_coins bigint not null default 5000
        check (balance_coins >= 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.wallet_transactions (
    id bigint generated always as identity primary key,
    user_id uuid not null
        references auth.users(id) on delete cascade,
    amount_coins bigint not null,
    transaction_type text not null,
    game text,
    set_code text,
    opening_id bigint,
    note text,
    created_at timestamptz not null default now()
);

create index if not exists idx_wallet_transactions_user_created
    on public.wallet_transactions (user_id, created_at desc);

create table if not exists public.user_collection (
    user_id uuid not null
        references auth.users(id) on delete cascade,
    card_key text not null,
    game text not null,
    product_set text not null,
    card_number text not null default '',
    name text not null,
    rarity text not null default '',
    variant text not null default '',
    drop_class text not null default '',
    image_url text,
    quantity integer not null default 1
        check (quantity >= 0),
    first_obtained_at timestamptz not null default now(),
    last_obtained_at timestamptz not null default now(),
    primary key (user_id, card_key)
);

create index if not exists idx_collection_user_game_set
    on public.user_collection (user_id, game, product_set);

create table if not exists public.pack_openings (
    id bigint generated always as identity primary key,
    user_id uuid not null
        references auth.users(id) on delete cascade,
    game text not null,
    set_code text not null,
    price_coins bigint not null,
    balance_after bigint not null,
    opened_at timestamptz not null default now()
);

create index if not exists idx_pack_openings_user
    on public.pack_openings (user_id, opened_at desc);

create table if not exists public.opening_cards (
    id bigint generated always as identity primary key,
    opening_id bigint not null
        references public.pack_openings(id) on delete cascade,
    position integer not null,
    card_key text,
    card_json jsonb not null
);

create index if not exists idx_opening_cards_opening
    on public.opening_cards (opening_id, position);


create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_username text;
begin
    v_username :=
        coalesce(
            nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
            nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
            'player'
        )
        || '-' || left(new.id::text, 6);

    insert into public.profiles (
        id,
        username
    )
    values (
        new.id,
        v_username
    )
    on conflict (id) do nothing;

    insert into public.wallets (
        user_id,
        balance_coins
    )
    values (
        new.id,
        5000
    )
    on conflict (user_id) do nothing;

    insert into public.wallet_transactions (
        user_id,
        amount_coins,
        transaction_type,
        note
    )
    select
        new.id,
        5000,
        'starter',
        'Solde de départ'
    where not exists (
        select 1
        from public.wallet_transactions
        where user_id = new.id
          and transaction_type = 'starter'
    );

    return new;
end;
$$;

drop trigger if exists on_auth_user_created
on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute procedure public.handle_new_user();


create or replace function public.open_booster_transaction(
    p_user_id uuid,
    p_game text,
    p_set_code text,
    p_price_coins bigint,
    p_cards jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_balance bigint;
    v_new_balance bigint;
    v_opening_id bigint;
    v_card jsonb;
    v_position integer := 0;
    v_collectible boolean;
begin
    if p_price_coins < 0 then
        raise exception 'INVALID_PRICE';
    end if;

    select balance_coins
    into v_balance
    from public.wallets
    where user_id = p_user_id
    for update;

    if v_balance is null then
        raise exception 'WALLET_NOT_FOUND';
    end if;

    if v_balance < p_price_coins then
        raise exception 'INSUFFICIENT_FUNDS';
    end if;

    v_new_balance := v_balance - p_price_coins;

    update public.wallets
    set
        balance_coins = v_new_balance,
        updated_at = now()
    where user_id = p_user_id;

    insert into public.pack_openings (
        user_id,
        game,
        set_code,
        price_coins,
        balance_after
    )
    values (
        p_user_id,
        p_game,
        p_set_code,
        p_price_coins,
        v_new_balance
    )
    returning id into v_opening_id;

    for v_card in
        select value
        from jsonb_array_elements(p_cards)
    loop
        v_position := v_position + 1;

        insert into public.opening_cards (
            opening_id,
            position,
            card_key,
            card_json
        )
        values (
            v_opening_id,
            v_position,
            nullif(v_card ->> 'card_key', ''),
            v_card
        );

        v_collectible :=
            coalesce(
                (v_card ->> 'collectible')::boolean,
                true
            );

        if
            v_collectible
            and nullif(v_card ->> 'card_key', '') is not null
        then
            insert into public.user_collection (
                user_id,
                card_key,
                game,
                product_set,
                card_number,
                name,
                rarity,
                variant,
                drop_class,
                image_url,
                quantity,
                first_obtained_at,
                last_obtained_at
            )
            values (
                p_user_id,
                v_card ->> 'card_key',
                p_game,
                coalesce(
                    v_card ->> 'product_set',
                    p_set_code
                ),
                coalesce(v_card ->> 'card_number', ''),
                coalesce(v_card ->> 'name', ''),
                coalesce(v_card ->> 'rarity', ''),
                coalesce(v_card ->> 'variant', ''),
                coalesce(v_card ->> 'drop_class', ''),
                nullif(v_card ->> 'image_url', ''),
                1,
                now(),
                now()
            )
            on conflict (user_id, card_key)
            do update set
                quantity =
                    public.user_collection.quantity + 1,
                last_obtained_at = now(),
                name = excluded.name,
                rarity = excluded.rarity,
                variant = excluded.variant,
                drop_class = excluded.drop_class,
                image_url = coalesce(
                    excluded.image_url,
                    public.user_collection.image_url
                );
        end if;
    end loop;

    insert into public.wallet_transactions (
        user_id,
        amount_coins,
        transaction_type,
        game,
        set_code,
        opening_id,
        note
    )
    values (
        p_user_id,
        -p_price_coins,
        'booster_purchase',
        p_game,
        p_set_code,
        v_opening_id,
        'Ouverture booster '
            || p_game
            || ' '
            || p_set_code
    );

    return jsonb_build_object(
        'opening_id',
        v_opening_id,
        'balance',
        v_new_balance
    );
end;
$$;

revoke all
on function public.open_booster_transaction(
    uuid,
    text,
    text,
    bigint,
    jsonb
)
from public, anon, authenticated;

grant execute
on function public.open_booster_transaction(
    uuid,
    text,
    text,
    bigint,
    jsonb
)
to service_role;


alter table public.profiles
enable row level security;

alter table public.wallets
enable row level security;

alter table public.wallet_transactions
enable row level security;

alter table public.user_collection
enable row level security;

alter table public.pack_openings
enable row level security;

alter table public.opening_cards
enable row level security;


drop policy if exists "profiles_select_self"
on public.profiles;

create policy "profiles_select_self"
on public.profiles
for select
to authenticated
using (id = auth.uid());


drop policy if exists "wallet_select_self"
on public.wallets;

create policy "wallet_select_self"
on public.wallets
for select
to authenticated
using (user_id = auth.uid());


drop policy if exists "wallet_transactions_select_self"
on public.wallet_transactions;

create policy "wallet_transactions_select_self"
on public.wallet_transactions
for select
to authenticated
using (user_id = auth.uid());


drop policy if exists "collection_select_self"
on public.user_collection;

create policy "collection_select_self"
on public.user_collection
for select
to authenticated
using (user_id = auth.uid());


drop policy if exists "openings_select_self"
on public.pack_openings;

create policy "openings_select_self"
on public.pack_openings
for select
to authenticated
using (user_id = auth.uid());


drop policy if exists "opening_cards_select_self"
on public.opening_cards;

create policy "opening_cards_select_self"
on public.opening_cards
for select
to authenticated
using (
    exists (
        select 1
        from public.pack_openings p
        where p.id = opening_cards.opening_id
          and p.user_id = auth.uid()
    )
);
