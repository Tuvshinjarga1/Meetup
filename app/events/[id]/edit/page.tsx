"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format, parse } from "date-fns";
import { CalendarIcon, ImageIcon, MapPinIcon, X } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MainNav } from "@/components/main-nav";
import { Footer } from "@/components/footer";
import { useAuth } from "@/contexts/auth-context";
import { getEvent, updateEvent } from "@/lib/event-service";
import { getImageFromStorage } from "@/lib/image-service";
import { use } from "react";

type PageParams = {
  id: string;
};

export default function EditEventPage(props: { params: Promise<PageParams> }) {
  const router = useRouter();
  const { user } = useAuth();
  const { id: eventId } = use(props.params);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState<Date>();
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [originalEvent, setOriginalEvent] = useState<any>(null);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    time: "",
    location: "",
    isOnline: false,
    eventType: "",
    image: null as File | null,
  });

  useEffect(() => {
    const fetchEvent = async () => {
      if (!eventId) {
        router.push("/dashboard");
        return;
      }

      try {
        setIsLoading(true);
        const event = await getEvent(eventId);

        // Зөвхөн зохион байгуулагч эвентээ засах боломжтой
        if (user?.uid !== event.createdBy) {
          setError("Та зөвхөн өөрийн үүсгэсэн эвентээ засах эрхтэй");
          return;
        }

        setOriginalEvent(event);

        // Огноог форматлаж date объект болгох
        if (event.date) {
          try {
            const parsedDate = parse(event.date, "yyyy.MM.dd", new Date());
            setDate(parsedDate);
          } catch (error) {
            console.error("Could not parse date:", error);
          }
        }

        // Зураг байгаа бол харуулах
        if (event.imageUrl) {
          const imageUrl = event.imageUrl;
          setImagePreview(imageUrl);
        }

        // Формын утгыг эвентээс авсан датагаар бөглөх
        setFormData({
          title: event.title || "",
          description: event.description || "",
          time: event.time || "",
          location: event.location || "",
          isOnline: event.isOnline || false,
          eventType: event.eventType || "",
          image: null,
        });
      } catch (error) {
        console.error("Error fetching event:", error);
        setError("Эвент олдсонгүй.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvent();
  }, [eventId, user, router]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFormData((prev) => ({ ...prev, image: file }));

      // Зургийн preview үүсгэх
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setFormData((prev) => ({ ...prev, image: null }));
    setImagePreview(originalEvent?.imageUrl || null);
    // Файл сонгох хэсгийг цэвэрлэх
    const fileInput = document.getElementById("image") as HTMLInputElement;
    if (fileInput) fileInput.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      alert("Нэвтэрнэ үү");
      router.push("/auth/login");
      return;
    }

    if (!date) {
      alert("Огноо сонгоно уу");
      return;
    }

    if (!formData.eventType) {
      alert("Эвентийн төрөл сонгоно уу");
      return;
    }

    try {
      setIsSubmitting(true);

      const eventData = {
        title: formData.title,
        description: formData.description,
        date: format(date, "yyyy.MM.dd"),
        time: formData.time,
        location: formData.location,
        isOnline: formData.isOnline,
        eventType: formData.eventType,
      };

      await updateEvent(eventId, eventData, formData.image || undefined);
      router.push(`/events/${eventId}`);
    } catch (err) {
      console.error(err);
      alert("Эвент шинэчлэхэд алдаа гарлаа");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen">
        <MainNav />
        <main className="flex-1 container py-8">
          <div className="flex items-center justify-center h-[400px]">
            <p className="text-muted-foreground">Ачааллаж байна...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col min-h-screen">
        <MainNav />
        <main className="flex-1 container py-8">
          <div className="flex flex-col items-center justify-center h-[400px] text-center">
            <h2 className="text-2xl font-bold mb-4">Алдаа</h2>
            <p className="text-muted-foreground mb-6">{error}</p>
            <div className="flex gap-4">
              <Button variant="outline" onClick={() => router.back()}>
                Буцах
              </Button>
              <Button onClick={() => router.push("/dashboard")}>
                Хянах самбар
              </Button>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <MainNav />

      <main className="flex-1 container py-8">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Эвент засах</h1>

          <Card>
            <CardHeader>
              <CardTitle>Эвентийн мэдээлэл</CardTitle>
              <CardDescription>
                Эвентийн талаарх мэдээллийг шинэчлэх
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="title">Гарчиг</Label>
                  <Input
                    id="title"
                    name="title"
                    placeholder="Эвентийн нэр"
                    required
                    value={formData.title}
                    onChange={handleChange}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Тайлбар</Label>
                  <Textarea
                    id="description"
                    name="description"
                    placeholder="Эвентийн тайлбар"
                    required
                    className="min-h-[120px]"
                    value={formData.description}
                    onChange={handleChange}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="date">Огноо</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left font-normal"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {date ? format(date, "yyyy.MM.dd") : "Огноо сонгох"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={date}
                          onSelect={setDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="time">Цаг</Label>
                    <Input
                      id="time"
                      name="time"
                      placeholder="Жишээ: 14:00 - 17:00"
                      required
                      value={formData.time}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="eventType">Эвентийн төрөл</Label>
                  <Select
                    value={formData.eventType}
                    onValueChange={(value) =>
                      setFormData({ ...formData, eventType: value })
                    }
                  >
                    <SelectTrigger id="eventType">
                      <SelectValue placeholder="Төрөл сонгох" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Технологи">Технологи</SelectItem>
                      <SelectItem value="Уран бүтээл">Уран бүтээл</SelectItem>
                      <SelectItem value="Хөгжим">Хөгжим</SelectItem>
                      <SelectItem value="Спорт">Спорт</SelectItem>
                      <SelectItem value="Боловсрол">Боловсрол</SelectItem>
                      <SelectItem value="Бизнес">Бизнес</SelectItem>
                      <SelectItem value="Бусад">Бусад</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="isOnline">Онлайн эвент эсэх</Label>
                    <Switch
                      id="isOnline"
                      checked={formData.isOnline}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, isOnline: checked })
                      }
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formData.isOnline
                      ? "Энэ нь онлайн эвент бөгөөд оролцогчид холбоосоор орж оролцоно"
                      : "Энэ нь биечлэн уулзах эвент бөгөөд тодорхой байршилд зохион байгуулагдана"}
                  </p>
                </div>

                {!formData.isOnline && (
                  <div className="space-y-2">
                    <Label htmlFor="location">Байршил</Label>
                    <div className="relative">
                      <MapPinIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <Input
                        id="location"
                        name="location"
                        placeholder="Эвент болох газрын хаяг"
                        className="pl-10"
                        required={!formData.isOnline}
                        value={formData.location}
                        onChange={handleChange}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Эвент болох газрын хаягийг оруулна уу
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="image">Зураг</Label>
                  <div className="border-2 border-dashed rounded-md p-6 flex flex-col items-center justify-center">
                    {imagePreview ? (
                      <div className="relative w-full">
                        <div className="absolute top-2 right-2 z-10">
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="h-7 w-7 rounded-full"
                            onClick={removeImage}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="relative aspect-video w-full overflow-hidden rounded-md mb-4">
                          <img
                            src={imagePreview}
                            alt="Эвентийн зураг"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <p className="text-sm text-center text-muted-foreground">
                          {formData.image?.name || "Одоогийн зураг"}
                        </p>
                      </div>
                    ) : (
                      <>
                        <ImageIcon className="h-10 w-10 text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground mb-2">
                          Зураг оруулахын тулд энд дарна уу эсвэл чирж оруулна
                          уу
                        </p>
                        <Input
                          id="image"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleFileChange}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            document.getElementById("image")?.click()
                          }
                        >
                          Зураг сонгох
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.back()}
                  >
                    Цуцлах
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Хадгалж байна..." : "Хадгалах"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
}
