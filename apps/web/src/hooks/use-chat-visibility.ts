import { useCallback, useRef, useState } from "react";

export function useChatVisibility() {
  const [isChatVisible, setIsChatVisible] = useState(true);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const handleInputFocus = useCallback(() => {
    setIsChatVisible(true);
  }, []);

  const toggleChatVisibility = useCallback(() => {
    setIsChatVisible((prev) => !prev);
  }, []);

  return {
    isChatVisible,
    setIsChatVisible,
    chatContainerRef,
    handleInputFocus,
    toggleChatVisibility,
  };
}
