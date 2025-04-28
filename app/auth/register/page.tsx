"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useAuth } from "@/contexts/auth-context"

export default function Register() {
  const router = useRouter()
  const { register } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    acceptTerms: false,
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleCheckboxChange = (checked: boolean) => {
    setFormData((prev) => ({ ...prev, acceptTerms: checked }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (formData.password !== formData.confirmPassword) {
      setError("Нууц үг таарахгүй байна")
      return
    }

    if (!formData.acceptTerms) {
      setError("Үйлчилгээний нөхцөлийг зөвшөөрнө үү")
      return
    }

    try {
      setIsLoading(true)
      await register(formData.email, formData.password, formData.name)
      router.push("/auth/verify-email")
    } catch (err: any) {
      console.error(err)
      if (err.code === "auth/email-already-in-use") {
        setError("Энэ и-мэйл хаяг бүртгэлтэй байна")
      } else if (err.code === "auth/weak-password") {
        setError("Нууц үг хэтэрхий богино байна")
      } else {
        setError(err.message || "Бүртгэл үүсгэхэд алдаа гарлаа")
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container max-w-md py-10">
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Бүртгүүлэх</CardTitle>
          <CardDescription className="text-center">Шинэ хэрэглэгчийн бүртгэл үүсгэх</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Нэр</Label>
              <Input
                id="name"
                name="name"
                placeholder="Таны нэр"
                required
                value={formData.name}
                onChange={handleChange}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">И-мэйл</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="name@example.com"
                required
                value={formData.email}
                onChange={handleChange}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Нууц үг</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                value={formData.password}
                onChange={handleChange}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Нууц үг баталгаажуулах</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                value={formData.confirmPassword}
                onChange={handleChange}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox id="terms" checked={formData.acceptTerms} onCheckedChange={handleCheckboxChange} />
              <label
                htmlFor="terms"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                <span>Үйлчилгээний </span>
                <Link href="/terms" className="text-primary hover:underline">
                  нөхцөлийг
                </Link>
                <span> зөвшөөрч байна</span>
              </label>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Бүртгэж байна..." : "Бүртгүүлэх"}
            </Button>

            <div className="mt-4 text-center text-sm">
              Бүртгэлтэй юу?{" "}
              <Link href="/auth/login" className="text-primary hover:underline">
                Нэвтрэх
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
