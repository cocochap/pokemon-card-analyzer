'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider, usePostHog } from 'posthog-js/react'
import { useUser } from '@clerk/nextjs'
import { useEffect } from 'react'

if (typeof window !== 'undefined') {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host: 'https://eu.i.posthog.com',
    capture_pageview: true,
    capture_pageleave: true,
    person_profiles: 'identified_only',
  })
}

function PostHogIdentifier() {
  const { user, isLoaded } = useUser()
  const ph = usePostHog()

  useEffect(() => {
    if (!isLoaded) return
    if (user) {
      ph.identify(user.id, {
        email: user.emailAddresses[0]?.emailAddress,
        name: user.fullName,
      })
    } else {
      ph.reset()
    }
  }, [user, isLoaded, ph])

  return null
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  return (
    <PHProvider client={posthog}>
      <PostHogIdentifier />
      {children}
    </PHProvider>
  )
}
