"use client"

import React from "react"
import { AnimatePresence, motion } from "framer-motion"
import { AlertTriangle, X } from "lucide-react"

import { cn } from "ui/lib/utils"
import { Button } from "@/components/ui/button"

interface InterruptPromptProps {
  isOpen: boolean
  close: () => void
  onConfirm?: () => void
}

export function InterruptPrompt({ isOpen, close, onConfirm }: InterruptPromptProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
          />
          <motion.div
            className={cn(
              "fixed left-[50%] top-[50%] z-50 w-full max-w-md translate-x-[-50%] translate-y-[-50%] rounded-lg border bg-background p-6 shadow-lg"
            )}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-start gap-4">
              <div className="shrink-0">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold">Interrupt generation?</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Are you sure you want to stop the current generation and start a new one?
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={close}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={close}>
                Cancel
              </Button>
              <Button
                variant="default"
                onClick={() => {
                  onConfirm?.()
                  close()
                }}
              >
                Interrupt
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}