// Simplified footer component shared across pages
// Displays minimal links to match logged-out footer style

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-white py-8">
      <div className="container mx-auto px-4 border-t border-gray-800 pt-4 text-center md:flex md:justify-between md:items-center">
        <p className="text-sm text-gray-500">© {new Date().getFullYear()} Blueprint. All rights reserved.</p>
        <div className="mt-4 md:mt-0 flex justify-center md:justify-end space-x-6">
          <a href="#" className="text-sm text-gray-500 hover:text-gray-300 transition-colors duration-300">
            Privacy Policy
          </a>
          <a href="#" className="text-sm text-gray-500 hover:text-gray-300 transition-colors duration-300">
            Terms of Service
          </a>
        </div>
      </div>
    </footer>
  );
}
