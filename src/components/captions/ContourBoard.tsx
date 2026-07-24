import React, {
  Children,
  cloneElement,
  isValidElement,
  useId,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";

import {
  CONTOUR_LINE_HEIGHT,
  CONTOUR_PAD_X_EM,
  CONTOUR_PAD_Y_EM,
  CONTOUR_RADIUS_EM,
} from "./contour-board";

/**
 * Merged sticker silhouette via inline line boxes + goo filter.
 * Children must be inline-level (e.g. inline-block word spans).
 */
export const ContourBoard: React.FC<{
  fill: string;
  textAlign: "left" | "center" | "right";
  textStyle: CSSProperties;
  children: ReactNode;
}> = ({ fill, textAlign, textStyle, children }) => {
  const rawId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const filterId = `contour-goo-${rawId}`;
  const items = Children.toArray(children);

  const flowStyle: CSSProperties = {
    ...textStyle,
    display: "inline",
    padding: `${CONTOUR_PAD_Y_EM}em ${CONTOUR_PAD_X_EM}em`,
    borderRadius: `${CONTOUR_RADIUS_EM}em`,
    lineHeight: CONTOUR_LINE_HEIGHT,
    maxWidth: "100%",
    boxDecorationBreak: "clone",
    WebkitBoxDecorationBreak: "clone",
    boxSizing: "border-box",
    margin: 0,
  };

  const cloneLayer = (layer: "fill" | "text") =>
    items.map((child, i) => {
      if (!isValidElement(child)) return child;
      const el = child as ReactElement<{ silhouette?: boolean }>;
      return cloneElement(el, {
        key: `${layer}-${el.key ?? i}`,
        ...(layer === "fill" ? { silhouette: true } : null),
      });
    });

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        maxWidth: "100%",
        textAlign,
      }}
    >
      <svg
        width={0}
        height={0}
        aria-hidden
        style={{ position: "absolute", overflow: "hidden" }}
      >
        <defs>
          <filter
            id={filterId}
            x="-30%"
            y="-30%"
            width="160%"
            height="160%"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur
              in="SourceGraphic"
              stdDeviation="8"
              result="blur"
            />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -10"
              result="goo"
            />
          </filter>
        </defs>
      </svg>

      <div
        aria-hidden
        style={{
          width: "100%",
          textAlign,
          filter: `url(#${filterId})`,
        }}
      >
        <span
          style={{
            ...flowStyle,
            color: "transparent",
            WebkitTextFillColor: "transparent",
            backgroundColor: fill,
          }}
        >
          {cloneLayer("fill")}
        </span>
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          width: "100%",
          textAlign,
        }}
      >
        <span
          style={{
            ...flowStyle,
            backgroundColor: "transparent",
          }}
        >
          {cloneLayer("text")}
        </span>
      </div>
    </div>
  );
};
