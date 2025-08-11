import { useCallback, useEffect, useRef, useState } from "react";

export function useChatVisibility() {
  const [isChatVisible, setIsChatVisible] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const handleInputFocus = useCallback(() => {
    setIsChatVisible(true);
  }, []);

  // Handle clicks outside the chat container
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        chatContainerRef.current &&
        !chatContainerRef.current.contains(event.target as Node)
      ) {
        setIsChatVisible(false);
      }
    };

    // Use capture phase to ensure we catch the event before it's stopped
    document.addEventListener("mousedown", handleClickOutside, true);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside, true);
    };
  }, []);

  return {
    isChatVisible,
    setIsChatVisible,
    chatContainerRef,
    handleInputFocus,
  };
}
