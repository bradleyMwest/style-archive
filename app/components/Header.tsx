import Link from 'next/link';

export default function Header() {
  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="text-xl font-bold text-gray-900">
            Style Archive
          </Link>
          <nav className="flex space-x-8">
            <Link href="/" className="text-gray-700 hover:text-gray-900">
              Home
            </Link>
            <Link href="/inventory" className="text-gray-700 hover:text-gray-900">
              Inventory
            </Link>
            <Link href="/outfits" className="text-gray-700 hover:text-gray-900">
              Outfits
            </Link>
            <Link href="/shop" className="text-gray-700 hover:text-gray-900">
              Shop
            </Link>
            <Link href="/add-item" className="text-gray-700 hover:text-gray-900">
              Add Item
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
