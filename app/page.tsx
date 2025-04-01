"use client"

import { useState, useEffect } from "react"
import { Supabase } from "./utils/supabaseClient"
import { useRouter } from "next/navigation"
import { Mail, Lock, User, ArrowRight, Loader2, Moon, Sun } from "lucide-react"

const AuthPage = () => {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [isSignUp, setIsSignUp] = useState(false)
  const [darkMode, setDarkMode] = useState(false)

  const router = useRouter()

  useEffect(() => {
    // Apply dark mode class to body
    if (darkMode) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }, [darkMode])

  const handleSignUp = async () => {
    if (!email || !password || !name) {
      setError("Please fill in all fields")
      return
    }

    setLoading(true)
    setError("")

    try {
      const { data, error } = await Supabase.auth.signUp({ email, password })

      if (error) {
        setError(error.message)
        return
      }

      if (data?.user?.id) {
        const { error: insertError } = await Supabase.from("users").insert([
          {
            id: data.user.id,
            email: email,
            name: name,
          },
        ])

        if (insertError) {
          console.error("⚠️ Error inserting user:", insertError)
          setError("Failed to create user profile. Please try again.")
          return
        }

        alert("Check your email for verification!")
        setIsSignUp(false)
      } else {
        setError("User ID missing after signup")
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.")
      console.error("Signup Error:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleSignIn = async () => {
    if (!email || !password) {
      setError("Please enter both email and password")
      return
    }

    setLoading(true)
    setError("")

    try {
      const { data, error } = await Supabase.auth.signInWithPassword({ email, password })

      if (error) {
        setError(error.message)
        return
      }

      if (!data?.user) {
        setError("Login failed, user not found.")
        return
      }

      document.cookie = `supabase-session=${data.session?.access_token}; path=/`
      router.push(`/chat/${data.user.id}`)
    } catch (err) {
      setError("Something went wrong. Please try again.")
      console.error("Login Error:", err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 transition-colors duration-300">
      <div className="absolute top-4 right-4">
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="p-2 rounded-full hover:bg-muted transition-colors duration-200"
          aria-label="Toggle dark mode"
        >
          {darkMode ? <Sun size={24} /> : <Moon size={24} />}
        </button>
      </div>

      <div className="w-full max-w-md bg-card rounded-2xl shadow-lg p-8 border border-border animate-fade-in">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center">
            <Mail size={32} className={`${darkMode ? "text-black" : "text-white"}`} />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-center mb-6">{isSignUp ? "Create an Account" : "Welcome Back"}</h1>

        <div className="space-y-4">
          {isSignUp && (
            <div className="relative animate-slide-up">
              <User size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Full Name"
                className="w-full pl-10 pr-4 py-3 rounded-lg bg-muted border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all duration-200"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          )}

          <div className="relative animate-slide-up" style={{ animationDelay: isSignUp ? "0.1s" : "0s" }}>
            <Mail size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
            <input
              type="email"
              placeholder="Email Address"
              className="w-full pl-10 pr-4 py-3 rounded-lg bg-muted border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all duration-200"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="relative animate-slide-up" style={{ animationDelay: isSignUp ? "0.2s" : "0.1s" }}>
            <Lock size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
            <input
              type="password"
              placeholder="Password"
              className="w-full pl-10 pr-4 py-3 rounded-lg bg-muted border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all duration-200"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-500 p-3 rounded-lg text-sm animate-fade-in">
              {error}
            </div>
          )}

          <button
            className={`w-full bg-primary hover:bg-primary-dark  font-medium py-3 px-4 rounded-lg flex items-center justify-center transition-all duration-300 shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 animate-slide-up ${darkMode ? "text-black" : "text-white"}`}
            onClick={isSignUp ? handleSignUp : handleSignIn}
            disabled={loading}
            style={{ animationDelay: isSignUp ? "0.3s" : "0.2s" }}
          >
            {loading ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <>
                <span>{isSignUp ? "Create Account" : "Sign In"}</span>
                <ArrowRight size={18} className="ml-2" />
              </>
            )}
          </button>

          <div
            className="text-center mt-6 text-sm text-muted-foreground animate-slide-up"
            style={{ animationDelay: isSignUp ? "0.4s" : "0.3s" }}
          >
            {isSignUp ? "Already have an account?" : "Don't have an account?"}
            <button
              onClick={() => {
                setIsSignUp(!isSignUp)
                setError("")
              }}
              className="ml-1 text-primary hover:text-primary-dark font-medium transition-colors"
            >
              {isSignUp ? "Sign In" : "Sign Up"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AuthPage

