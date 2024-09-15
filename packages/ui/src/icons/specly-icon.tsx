export function SpeclyIcon({
  className,
  theme,
}: {
  className?: string;
  theme: "light" | "dark";
}) {
  return (
    <>
      {theme === "light" ? (
        <svg
          className={className}
          width="563"
          height="300"
          viewBox="0 0 563 300"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <title>Specly</title>
          <path
            d="M37.5 262.5V225H0V187.5H75V225H187.5V150H37.5V112.5H0V37.5H37.5V0H225V37.5H262.5V75H187.5V37.5H75V112.5H225V150H262.5V225H225V262.5H37.5ZM300 300V262.5H562.5V300H300Z"
            fill="#111113"
          />
        </svg>
      ) : (
        <svg
          className={className}
          width="563"
          height="300"
          viewBox="0 0 563 300"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <title>Specly</title>
          <path
            d="M37.5 262.5V225H0V187.5H75V225H187.5V150H37.5V112.5H0V37.5H37.5V0H225V37.5H262.5V75H187.5V37.5H75V112.5H225V150H262.5V225H225V262.5H37.5ZM300 300V262.5H562.5V300H300Z"
            fill="white"
          />
        </svg>
      )}
    </>
  );
}
