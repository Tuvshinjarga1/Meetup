"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  CalendarIcon,
  MapPinIcon,
  PlusIcon,
  SearchIcon,
  UsersIcon,
} from "lucide-react";
import { MainNav } from "@/components/main-nav";
import { Footer } from "@/components/footer";
import { getEvents, type EventData } from "@/lib/event-service";
// Import the FirebaseIndexNotice component
// import { FirebaseIndexNotice } from "@/components/firebase-index-notice"

export default function EventsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState({
    eventType: "",
    isOnline: false,
  });
  const [events, setEvents] = useState<EventData[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<EventData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setIsLoading(true);
        const eventsData = await getEvents();
        setEvents(eventsData);
        setFilteredEvents(eventsData);
      } catch (error) {
        console.error("Error fetching events:", error);
        // Set empty arrays to avoid undefined errors
        setEvents([]);
        setFilteredEvents([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvents();
  }, []);

  useEffect(() => {
    // Filter events based on search term and filters
    const filtered = events.filter((event) => {
      const matchesSearch =
        event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.description.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesType =
        !filters.eventType ||
        filters.eventType === "all" ||
        event.eventType === filters.eventType;
      const matchesOnline =
        !filters.isOnline || event.isOnline === filters.isOnline;

      return matchesSearch && matchesType && matchesOnline;
    });

    setFilteredEvents(filtered);
  }, [searchTerm, filters, events]);

  return (
    <div className="flex flex-col min-h-screen">
      <MainNav />

      <main className="flex-1 container py-8">
        {/* <FirebaseIndexNotice /> */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Эвентүүд</h1>
          <Link href="/events/create">
            <Button>
              <PlusIcon className="mr-2 h-4 w-4" />
              Эвент үүсгэх
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mb-8">
          <div className="lg:col-span-3">
            <div className="relative mb-6">
              <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Эвент хайх..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center h-[400px]">
                <p className="text-muted-foreground">Ачааллаж байна...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredEvents.map((event) => (
                  <Link
                    href={`/events/${event.id}`}
                    key={event.id}
                    className="group"
                  >
                    <div className="border rounded-lg overflow-hidden transition-all hover:shadow-md">
                      <div className="aspect-video bg-gray-100 relative">
                        <img
                          src={
                            event.imageUrl ||
                            `/placeholder.svg?height=200&width=400&text=Эвент`
                          }
                          alt={event.title}
                          className="w-full h-full object-cover"
                        />
                        {event.isOnline && (
                          <div className="absolute top-2 right-2 bg-primary text-white text-xs px-2 py-1 rounded-full">
                            Онлайн
                          </div>
                        )}
                      </div>
                      <div className="p-4">
                        <h3 className="font-bold text-xl mb-2 group-hover:text-primary">
                          {event.title}
                        </h3>
                        <p className="text-gray-600 mb-4 line-clamp-2">
                          {event.description}
                        </p>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <div className="flex items-center gap-1">
                            <CalendarIcon size={16} />
                            <span>{event.date}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <MapPinIcon size={16} />
                            <span>{event.location}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <UsersIcon size={16} />
                            <span>
                              {Object.keys(event.attendees || {}).length}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}

                {filteredEvents.length === 0 && (
                  <div className="col-span-full text-center py-12">
                    <p className="text-muted-foreground mb-4">
                      Хайлтын үр дүн олдсонгүй
                    </p>
                    <Button
                      onClick={() => {
                        setSearchTerm("");
                        setFilters({ eventType: "", isOnline: false });
                      }}
                    >
                      Шүүлтүүрийг цэвэрлэх
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="lg:col-span-1">
            <div className="border rounded-lg p-6 space-y-6 sticky top-6">
              <h2 className="font-bold text-xl mb-4">Шүүлтүүр</h2>

              <div className="space-y-2">
                <Label htmlFor="event-type">Эвентийн төрөл</Label>
                <Select
                  value={filters.eventType}
                  onValueChange={(value) =>
                    setFilters({ ...filters, eventType: value })
                  }
                >
                  <SelectTrigger id="event-type">
                    <SelectValue placeholder="Бүгд" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Бүгд</SelectItem>
                    <SelectItem value="Технологи">Технологи</SelectItem>
                    <SelectItem value="Уран бүтээл">Уран бүтээл</SelectItem>
                    <SelectItem value="Хөгжим">Хөгжим</SelectItem>
                    <SelectItem value="Спорт">Спорт</SelectItem>
                    <SelectItem value="Боловсрол">Боловсрол</SelectItem>
                    <SelectItem value="Бизнес">Бизнес</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="online-only"
                  checked={filters.isOnline}
                  onCheckedChange={(checked) =>
                    setFilters({ ...filters, isOnline: checked as boolean })
                  }
                />
                <label
                  htmlFor="online-only"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Зөвхөн онлайн эвентүүд
                </label>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setFilters({ eventType: "", isOnline: false });
                }}
              >
                Шүүлтүүр цэвэрлэх
              </Button>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
