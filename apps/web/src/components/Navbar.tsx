"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export function Navbar() {
  const router = useRouter();

  const handleLogout = () => {
    // In a real app, clear tokens or session here
    router.push("/");
  };

  return (
    <nav className="bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 px-4 sm:px-6 lg:px-8">
      <div className="flex justify-between h-16">
        <div className="flex">
          <div className="flex-shrink-0 flex items-center">
            <span className="font-bold text-xl text-blue-600">TodoApp</span>
          </div>
          <div className="hidden sm:-my-px sm:ml-6 sm:flex sm:space-x-8">
            <Link
              href="/projects"
              className="border-blue-500 text-gray-900 dark:text-gray-100 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
            >
              Projects
            </Link>
          </div>
        </div>
        <div className="hidden sm:ml-6 sm:flex sm:items-center">
          <div className="ml-3 relative group">
            <div className="flex items-center space-x-3 cursor-pointer">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">My Account</span>
              <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                U
              </div>
            </div>
            
            {/* Dropdown menu */}
            <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white dark:bg-zinc-800 ring-1 ring-black ring-opacity-5 hidden group-hover:block z-50 border border-gray-200 dark:border-zinc-700">
              <a href="#" className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700">
                Profile
              </a>
              <a href="#" className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700">
                Settings
              </a>
              <button
                onClick={handleLogout}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
