import { useCallback, useEffect, useRef, useState } from "react";

import type { TPendingMessage } from "@weldr/shared/types";

interface UseChatVisibilityOptions {
  initialVisibility: boolean;
  pendingMessage: TPendingMessage;
}

export function useChatVisibility({
  initialVisibility,
  pendingMessage,
}: UseChatVisibilityOptions) {
  const [isChatVisible, setIsChatVisible] = useState(initialVisibility);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const handleInputFocus = useCallback(() => {
    setIsChatVisible(true);
  }, []);

  // Handle clicks outside the chat container
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Don't hide if there's a pending message (generation in progress)
      if (pendingMessage) {
        return;
      }

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
  }, [pendingMessage]);

  return {
    isChatVisible,
    setIsChatVisible,
    chatContainerRef,
    handleInputFocus,
  };
}
