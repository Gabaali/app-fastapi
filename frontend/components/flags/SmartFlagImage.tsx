"use client";

import {
  type ImgHTMLAttributes,
  useEffect,
  useMemo,
  useState,
} from "react";

const FLAG_EXTENSIONS = [
  "webp",
  "gif",
  "png",
  "jpg",
  "jpeg",
  "svg",
] as const;

type Props = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  "src"
> & {
  src: string;
};

function hasKnownExtension(
  src: string,
) {
  return /\.(webp|gif|png|jpe?g|svg)$/i
    .test(src.split("?")[0]);
}

function removeKnownExtension(
  src: string,
) {
  return src.replace(
    /\.(webp|gif|png|jpe?g|svg)$/i,
    ""
  );
}

export default function SmartFlagImage({
  src,
  alt,
  onError,
  ...props
}: Props) {
  const candidates = useMemo(() => {
    if (hasKnownExtension(src)) {
      const base = removeKnownExtension(
        src
      );

      return [
        src,
        ...FLAG_EXTENSIONS
          .map(
            (extension) =>
              `${base}.${extension}`
          )
          .filter(
            (candidate) =>
              candidate !== src
          ),
      ];
    }

    return FLAG_EXTENSIONS.map(
      (extension) =>
        `${src}.${extension}`
    );
  }, [src]);

  const [candidateIndex, setCandidateIndex] =
    useState(0);

  useEffect(() => {
    setCandidateIndex(0);
  }, [src]);

  const currentSrc =
    candidates[candidateIndex];

  if (!currentSrc) {
    return null;
  }

  return (
    <img
      {...props}
      src={currentSrc}
      alt={alt}
      onError={(event) => {
        if (
          candidateIndex <
          candidates.length - 1
        ) {
          setCandidateIndex(
            (index) => index + 1
          );
          return;
        }

        onError?.(event);
      }}
    />
  );
}
