"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, CheckCircle2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useAuth } from "@/contexts/auth-context"

export default function ForgotPassword() {
  const { resetPassword } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [email, setEmail] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess(false)

    try {
      setIsLoading(true)
      await resetPassword(email)
      setSuccess(true)
    } catch (err: any) {
      console.error(err)
      if (err.code === "auth/user-not-found") {
        setError("Бүртгэлтэй и-мэйл хаяг олдсонгүй")
      } else {
        setError(err.message || "Нууц үг сэргээх холбоос илгээхэд алдаа гарлаа")
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container max-w-md py-10">
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Нууц үг сэргээх</CardTitle>
          <CardDescription className="text-center">
            И-мэйл хаягаа оруулж нууц үг сэргээх холбоос авна уу
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert variant="success" className="bg-green-50 border-green-200 text-green-800">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <AlertDescription>
                  Нууц үг сэргээх холбоосыг таны и-мэйл хаяг руу илгээлээ. И-мэйлээ шалгана уу.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">И-мэйл</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </CardContent>

          <CardFooter className="flex flex-col">
            <Button type="submit" className="w-full" disabled={isLoading || success}>
              {isLoading ? "Илгээж байна..." : "Холбоос илгээх"}
            </Button>

            <div className="mt-4 text-center text-sm">
              <Link href="/auth/login" className="text-primary hover:underline">
                Нэвтрэх хуудас руу буцах
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
