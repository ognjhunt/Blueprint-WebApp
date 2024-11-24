'use client'

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X } from "lucide-react"
import { Button } from "./button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./card"

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
  title?: string
}

export function Modal({ isOpen, onClose, children, title }: ModalProps) {
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", duration: 0.3 }}
            className="fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] z-50"
          >
            <Card className="w-[90vw] max-w-[500px] max-h-[90vh] overflow-y-auto">
              <CardHeader className="relative">
                {title && <CardTitle>{title}</CardTitle>}
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-4 top-4"
                  onClick={onClose}
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                {children}
              </CardContent>
            </Card>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
