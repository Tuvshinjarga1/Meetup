"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { AlertCircle, ImageIcon } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { MainNav } from "@/components/main-nav"
import { Footer } from "@/components/footer"
import { useAuth } from "@/contexts/auth-context"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { storage } from "@/lib/firebase"

export default function EditProfilePage() {
  const router = useRouter()
  const { user, userData, updateUserProfile } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [formData, setFormData] = useState({
    displayName: "",
    bio: "",
    avatar: null as File | null,
    interests: [] as string[],
  })

  const availableInterests = ["Технологи", "Уран бүтээл", "Хөгжим", "Спорт", "Боловсрол", "Бизнес", "Хоол", "Аялал"]

  useEffect(() => {
    if (userData) {
      setFormData({
        displayName: userData.displayName || "",
        bio: userData.bio || "",
        avatar: null,
        interests: userData.interests || [],
      })
    }
  }, [userData])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFormData((prev) => ({ ...prev, avatar: e.target.files![0] }))
    }
  }

  const handleInterestChange = (interest: string, checked: boolean) => {
    if (checked) {
      setFormData((prev) => ({
        ...prev,
        interests: [...prev.interests, interest],
      }))
    } else {
      setFormData((prev) => ({
        ...prev,
        interests: prev.interests.filter((i) => i !== interest),
      }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!user) {
      router.push("/auth/login")
      return
    }

    try {
      setIsLoading(true)

      let photoURL = userData?.photoURL || null

      // If there's a new avatar, upload it to storage
      if (formData.avatar) {
        const storageRef = ref(storage, `avatars/${user.uid}`)
        await uploadBytes(storageRef, formData.avatar)
        photoURL = await getDownloadURL(storageRef)
      }

      // Update user profile
      await updateUserProfile({
        displayName: formData.displayName,
        photoURL,
        bio: formData.bio,
        interests: formData.interests,
      })

      router.push("/dashboard")
    } catch (err: any) {
      console.error(err)
      setError(err.message || "Профайл шинэчлэхэд алдаа гарлаа")
    } finally {
      setIsLoading(false)
    }
  }

  if (!user || !userData) {
    return <div>Loading...</div>
  }

  return (
    <div className="flex flex-col min-h-screen">
      <MainNav />

      <main className="flex-1 container py-8">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Профайл засах</h1>

          <Card>
            <CardHeader>
              <CardTitle>Хувийн мэдээлэл</CardTitle>
              <CardDescription>Профайлын мэдээллээ шинэчлэх</CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-6">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="flex flex-col items-center space-y-4">
                  <Avatar className="w-24 h-24">
                    <AvatarImage
                      src={formData.avatar ? URL.createObjectURL(formData.avatar) : userData.photoURL || undefined}
                      alt={userData.displayName || "User"}
                    />
                    <AvatarFallback className="text-2xl">
                      {userData.displayName?.charAt(0) || user.email?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>

                  <div>
                    <Input id="avatar" type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                    <Button type="button" variant="outline" onClick={() => document.getElementById("avatar")?.click()}>
                      <ImageIcon className="h-4 w-4 mr-2" />
                      Зураг солих
                    </Button>
                  </div>

                  {formData.avatar && <p className="text-sm">Сонгосон файл: {formData.avatar.name}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="displayName">Нэр</Label>
                  <Input
                    id="displayName"
                    name="displayName"
                    placeholder="Таны нэр"
                    required
                    value={formData.displayName}
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
                    value={user.email || ""}
                    disabled
                  />
                  <p className="text-sm text-muted-foreground">И-мэйл хаягийг өөрчлөх боломжгүй</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Миний тухай</Label>
                  <Textarea
                    id="bio"
                    name="bio"
                    placeholder="Өөрийн тухай товч танилцуулга"
                    className="min-h-[120px]"
                    value={formData.bio}
                    onChange={handleChange}
                  />
                </div>

                <div className="space-y-4">
                  <Label>Сонирхол</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {availableInterests.map((interest) => (
                      <div key={interest} className="flex items-center space-x-2">
                        <Checkbox
                          id={`interest-${interest}`}
                          checked={formData.interests.includes(interest)}
                          onCheckedChange={(checked) => handleInterestChange(interest, checked as boolean)}
                        />
                        <label
                          htmlFor={`interest-${interest}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {interest}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>

              <CardFooter className="flex justify-between">
                <Button type="button" variant="outline" onClick={() => router.push("/dashboard")}>
                  Цуцлах
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? "Хадгалж байна..." : "Хадгалах"}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  )
}
