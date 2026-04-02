export default function Home() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Welcome to Style Archive
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          Organize your wardrobe, plan perfect outfits, and discover new items that match your style.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-2">Inventory</h2>
            <p className="text-gray-600 mb-4">
              View and manage all your clothing items with photos and details.
            </p>
            <a
              href="/inventory"
              className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              View Inventory
            </a>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-2">Outfits</h2>
            <p className="text-gray-600 mb-4">
              Create and save outfit combinations from your wardrobe.
            </p>
            <a
              href="/outfits"
              className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Plan Outfits
            </a>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-2">Shop</h2>
            <p className="text-gray-600 mb-4">
              Get recommendations for new items that complement your existing wardrobe.
            </p>
            <a
              href="/shop"
              className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Shop Now
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
