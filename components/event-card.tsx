import { format } from "date-fns";
import Link from "next/link";
import { CalendarIcon, MapPinIcon, UsersIcon } from "lucide-react";
import { getImageFromStorage } from "@/lib/image-service";

export type EventCardProps = {
  id: string;
  title: string;
  description: string;
  date: string;
  location: string;
  imageUrl?: string;
  attendeeCount: number;
  isOnline: boolean;
};

export function EventCard({
  id,
  title,
  description,
  date,
  location,
  imageUrl,
  attendeeCount,
  isOnline,
}: EventCardProps) {
  // Локал хадгалсан зургийг шалгаж харуулах
  const displayImageUrl = imageUrl
    ? getImageFromStorage(imageUrl)
    : "/placeholder.svg?height=200&width=400";

  return (
    <Link href={`/events/${id}`} className="group">
      <div className="border rounded-lg overflow-hidden transition-all hover:shadow-md">
        <div className="aspect-video bg-gray-100 relative">
          <img
            src={displayImageUrl}
            alt={title}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="p-4">
          <h3 className="font-bold text-xl mb-2 group-hover:text-primary">
            {title}
          </h3>
          <p className="text-gray-600 mb-4 line-clamp-2">{description}</p>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-1">
              <CalendarIcon size={16} />
              <span>{format(new Date(date), "yyyy.MM.dd")}</span>
            </div>
            <div className="flex items-center gap-1">
              <MapPinIcon size={16} />
              <span>{isOnline ? "Онлайн" : location}</span>
            </div>
            <div className="flex items-center gap-1">
              <UsersIcon size={16} />
              <span>{attendeeCount}</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
