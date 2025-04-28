import Link from "next/link"

export function Footer() {
  return (
    <footer className="border-t py-6 bg-gray-50">
      <div className="container">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 md:mb-0">
            <Link href="/" className="text-xl font-bold">
              MeetupMN
            </Link>
            <p className="text-gray-500 mt-1">© {new Date().getFullYear()} MeetupMN. Бүх эрх хуулиар хамгаалагдсан.</p>
          </div>
          <div className="flex gap-6">
            <Link href="/about" className="text-gray-500 hover:text-gray-900">
              Бидний тухай
            </Link>
            <Link href="/terms" className="text-gray-500 hover:text-gray-900">
              Үйлчилгээний нөхцөл
            </Link>
            <Link href="/privacy" className="text-gray-500 hover:text-gray-900">
              Нууцлалын бодлого
            </Link>
            <Link href="/contact" className="text-gray-500 hover:text-gray-900">
              Холбоо барих
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
