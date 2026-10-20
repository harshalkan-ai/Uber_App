'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SignInButton, SignUpButton, UserButton, useUser } from '@clerk/nextjs';
import { Share2, FileText, Car } from 'lucide-react';

interface NavbarProps {
  activeTab?: 'Ride' | 'Activity';
  onTabChange?: (tab: 'Ride') => void;
  onOpenActivity?: () => void;
}

export default function Navbar({ activeTab = 'Ride', onOpenActivity }: NavbarProps) {
  const { isSignedIn } = useUser();
  const [shareTooltip, setShareTooltip] = useState(false);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareTooltip(true);
      setTimeout(() => setShareTooltip(false), 2000);
    } catch {
      setShareTooltip(true);
      setTimeout(() => setShareTooltip(false), 2000);
    }
  };

  return (
    <header className="flex-none bg-white border-b border-neutral-200 z-50 relative h-16 shadow-sm">
      <div className="flex items-center h-16 px-4 md:px-8 gap-4 justify-between max-w-full">
        {/* Left: Brand Logo */}
        <div className="flex items-center gap-8 flex-shrink-0">
          <Link href="/" className="flex items-center">
            <span
              className="text-[26px] md:text-[28px] font-black tracking-tighter text-black select-none"
              style={{ fontFamily: "'Inter', sans-serif", letterSpacing: '-1.5px' }}
            >
              Uber
            </span>
          </Link>

          {/* Navigation Tabs: Ride, Activity, Driver Portal */}
          <nav className="flex items-center gap-1 h-16" role="navigation" aria-label="Main navigation">
            <Link
              href="/"
              id="nav-tab-ride"
              className={`relative flex items-center gap-2 px-4 h-full text-sm font-bold transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'Ride' ? 'text-black' : 'text-neutral-500 hover:text-black'
              }`}
            >
              <Car size={17} />
              <span>Ride</span>
              {activeTab === 'Ride' && (
                <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-black rounded-t-sm" />
              )}
            </Link>

            <Link
              href="/activity"
              id="nav-tab-activity"
              className={`relative flex items-center gap-2 px-4 h-full text-sm font-bold transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'Activity' ? 'text-black' : 'text-neutral-500 hover:text-black'
              }`}
            >
              <FileText size={16} />
              <span>Activity</span>
              {activeTab === 'Activity' && (
                <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-black rounded-t-sm" />
              )}
            </Link>
          </nav>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Share Button */}
          <div className="relative hidden md:block">
            <button
              id="btn-share"
              onClick={handleShare}
              className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-neutral-100 transition-colors text-neutral-600 cursor-pointer"
              title="Share App"
              aria-label="Share"
            >
              <Share2 size={17} />
            </button>
            {shareTooltip && (
              <div className="absolute top-10 right-0 bg-black text-white text-xs px-2.5 py-1.5 rounded-lg whitespace-nowrap animate-fadeIn z-50">
                Link copied!
              </div>
            )}
          </div>


          {/* Clerk Profile Avatar */}
          {isSignedIn ? (
            <UserButton
              appearance={{
                elements: {
                  avatarBox: 'w-8 h-8 md:w-9 md:h-9',
                },
              }}
            />
          ) : (
            <div className="flex items-center gap-2">
              <SignInButton mode="modal">
                <button
                  id="btn-signin"
                  className="px-3.5 py-1.5 text-xs md:text-sm font-semibold text-black border border-neutral-300 rounded-full hover:bg-neutral-50 transition-all whitespace-nowrap"
                >
                  Log in
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button
                  id="btn-signup"
                  className="px-3.5 py-1.5 text-xs md:text-sm font-semibold text-white bg-black rounded-full hover:bg-neutral-800 transition-all whitespace-nowrap"
                >
                  Sign up
                </button>
              </SignUpButton>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
