"use client";

import React from "react";
import styles from "./quail.module.css";

interface QuailProps {
  className?: string;
  /** Поёт: приподнимает бровку и кивает. */
  singing?: boolean;
  /** Зеркально отражена (для приглашения). */
  flip?: boolean;
  /** Счастливые закрытые глаза. */
  happy?: boolean;
}

/** Маскот — перепёлочка (плоский SVG, рисован вручную). */
const Quail: React.FC<QuailProps> = ({ className, singing = false, flip = false, happy = false }) => (
  <svg
    viewBox="0 0 140 120"
    className={className ? `${styles.quail} ${className}` : styles.quail}
    role="img"
    aria-label="Перепёлочка"
  >
    <g transform={flip ? "translate(140,0) scale(-1,1)" : undefined}>
      {/* хвост */}
      <path d="M28 62 L8 48 L14 62 L6 66 L18 72 Z" fill="#A87848" />
      {/* лапки */}
      <g stroke="#F2A33C" strokeWidth="4" strokeLinecap="round">
        <path d="M58 104 L54 114" />
        <path d="M78 104 L82 114" />
        <path d="M54 114 L48 117 M54 114 L54 118 M54 114 L60 117" fill="none" />
        <path d="M82 114 L76 117 M82 114 L82 118 M82 114 L88 117" fill="none" />
      </g>
      {/* тело */}
      <path
        d="M70 18 C98 18 116 42 116 68 C116 92 96 106 70 106 C44 106 24 92 24 68 C24 42 42 18 70 18 Z"
        fill="#C89B6B"
      />
      {/* живот */}
      <path
        d="M70 46 C90 46 102 62 102 78 C102 94 88 102 70 102 C52 102 38 94 38 78 C38 62 50 46 70 46 Z"
        fill="#F3E2C0"
      />
      {/* крапинки */}
      <g fill="#A87848">
        <ellipse cx="48" cy="44" rx="2.6" ry="3.4" transform="rotate(20 48 44)" />
        <ellipse cx="60" cy="34" rx="2.6" ry="3.4" transform="rotate(-10 60 34)" />
        <ellipse cx="74" cy="30" rx="2.6" ry="3.4" transform="rotate(15 74 30)" />
        <ellipse cx="40" cy="58" rx="2.4" ry="3" transform="rotate(30 40 58)" />
        <ellipse cx="98" cy="48" rx="2.4" ry="3" transform="rotate(-25 98 48)" />
        <ellipse cx="104" cy="64" rx="2.4" ry="3" transform="rotate(20 104 64)" />
      </g>
      {/* хохолок */}
      <g fill="#8F6238">
        <path d="M64 20 C60 8 66 4 68 2 C69 8 68 14 67 20 Z" />
        <path d="M72 19 C72 6 79 4 82 3 C80 9 77 15 75 20 Z" />
      </g>
      {/* клюв */}
      <path d="M103 58 L122 64 L103 71 Z" fill="#FF9F1C" stroke="#E2820B" strokeWidth="1" strokeLinejoin="round" />
      {/* щёчки */}
      <ellipse cx="94" cy="72" rx="7" ry="5.4" fill="#F2A9A0" opacity="0.9" />
      {/* глаз */}
      {happy ? (
        <path
          d="M88 56 C91 51 98 51 101 56"
          stroke="#3A2C1E"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
      ) : (
        <>
          <circle cx="95" cy="55" r="9" fill="#3A2C1E" />
          <circle cx="98" cy="52" r="3.2" fill="#fff" />
          <circle cx="91.5" cy="58.5" r="1.4" fill="#fff" opacity="0.7" />
        </>
      )}
      {singing && (
        <path
          d="M87 45 C91 41 99 41 103 45"
          stroke="#3A2C1E"
          strokeWidth="2.6"
          fill="none"
          strokeLinecap="round"
        />
      )}
      {/* крыло */}
      <path
        d="M46 62 C58 52 76 52 86 60 C92 66 90 78 80 84 C68 90 52 88 45 79 C41 73 42 66 46 62 Z"
        fill="#B58A5B"
      />
      <g stroke="#9A7043" strokeWidth="2" strokeLinecap="round" fill="none">
        <path d="M52 64 C58 68 62 74 63 82" />
        <path d="M62 60 C67 65 70 72 71 80" />
        <path d="M72 59 C76 64 78 70 79 77" />
      </g>
      {/* нотка */}
      <g className={styles.note} fill="#9B72CF">
        <circle cx="24" cy="26" r="4.2" />
        <rect x="27" y="8" width="2.6" height="18" rx="1.3" />
        <path d="M27 8 C31 9 34 11 34 15 C34 12 31 10.5 27 11 Z" />
      </g>
    </g>
  </svg>
);

export default Quail;
