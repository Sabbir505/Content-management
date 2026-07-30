"use client";

import { useState, useCallback } from "react";

interface UseCardStateOptions {
  onModalOpen?: () => void;
}

export function useCardState(options: UseCardStateOptions = {}) {
  const { onModalOpen } = options;
  const [imageError, setImageError] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBoostOpen, setIsBoostOpen] = useState(false);
  const [fullDescription, setFullDescription] = useState<string | null>(null);
  const [isLoadingDescription, setIsLoadingDescription] = useState(false);

  const openModal = useCallback(() => {
    setIsModalOpen(true);
    onModalOpen?.();
  }, [onModalOpen]);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setFullDescription(null);
  }, []);

  const openBoost = useCallback(() => setIsBoostOpen(true), []);
  const closeBoost = useCallback(() => setIsBoostOpen(false), []);

  return {
    imageError,
    setImageError,
    isModalOpen,
    isBoostOpen,
    fullDescription,
    setFullDescription,
    isLoadingDescription,
    setIsLoadingDescription,
    openModal,
    closeModal,
    openBoost,
    closeBoost,
  };
}
