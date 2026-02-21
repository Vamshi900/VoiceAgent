import type { SVGProps } from "react";

export function LogoMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 40 40"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <defs>
        <linearGradient id="bubbleGradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1F3A93" />
          <stop offset="100%" stopColor="#0FB6A9" />
        </linearGradient>
      </defs>
      <rect
        x="4"
        y="4"
        width="32"
        height="28"
        rx="10"
        fill="url(#bubbleGradient)"
      />
      <path
        d="M14 30L12 35L17 32"
        fill="none"
        stroke="#020617"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15 16C16.2 18.5 17.8 20 20 20C22.2 20 23.8 18.5 25 16"
        fill="none"
        stroke="#E5E7EB"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="27.5" cy="12.5" r="2" fill="#E5E7EB" />
    </svg>
  );
}

