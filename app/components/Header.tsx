import Link from 'next/link';
import { getCurrentUser } from '../lib/auth';
import { logout } from '../actions/auth';

export default async function Header() {
  const user = await getCurrentUser();
  const isAuthenticated = Boolean(user);

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="text-xl font-bold text-gray-900">
            Style Archive
          </Link>
          {isAuthenticated ? (
            <div className="flex items-center gap-8">
              <nav className="flex space-x-6 text-sm font-medium">
                <Link href="/" className="text-gray-700 hover:text-gray-900">
                  Home
                </Link>
                <Link href="/inventory" className="text-gray-700 hover:text-gray-900">
                  Inventory
                </Link>
                <Link href="/outfits" className="text-gray-700 hover:text-gray-900">
                  Outfits
                </Link>
                <Link href="/style" className="text-gray-700 hover:text-gray-900">
                  My Style
                </Link>
                <Link href="/shop" className="text-gray-700 hover:text-gray-900">
                  Shop
                </Link>
                <Link href="/add-item" className="text-gray-700 hover:text-gray-900">
                  Add Item
                </Link>
              </nav>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span className="hidden sm:inline">{user?.email}</span>
                <form action={logout}>
                  <button
                    type="submit"
                    className="rounded border border-gray-300 px-3 py-1.5 text-gray-700 hover:bg-gray-50"
                  >
                    Sign out
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-sm font-medium">
              <Link href="/login" className="text-gray-700 hover:text-gray-900">
                Sign in
              </Link>
              <Link
                href="/signup"
                className="rounded bg-blue-600 px-4 py-1.5 text-white hover:bg-blue-700"
              >
                Create account
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
