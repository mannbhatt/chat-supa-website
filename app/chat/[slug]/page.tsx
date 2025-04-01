"use client"
import type { Session } from "@supabase/supabase-js"
import { useParams } from "next/navigation"
import { useState, useEffect, useRef } from "react"
import { createClient } from "@supabase/supabase-js"
import ChatBox from "@/app/component/ChatBox"
import { Search, MessageSquare, Bell, Moon, Sun } from "lucide-react"
import Image from "next/image"
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
)

interface UserType {
  id: string
  name: string
  email: string
  created_at: string
}

interface LastMessageType {
  content: string
  time: string | null
}

const ChatPage = () => {
  const params = useParams()
  const slug = params?.slug

  const [session, setSession] = useState<Session | null>(null)
  const [users, setUsers] = useState<UserType[]>([])
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null)
  const [currentUser, setCurrentUser] = useState<UserType | null>(null)
  const [selected, setSelected] = useState<string>("All")
  const [loading, setLoading] = useState<boolean>(true)
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [FilteredUsers, setFilteredUsers] = useState<UserType[]>([])
  const [lastMessages, setLastMessages] = useState<Record<string, LastMessageType>>({})
  const [darkMode, setDarkMode] = useState<boolean>(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Apply dark mode class to body
    if (darkMode) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }, [darkMode])

  useEffect(() => {
    const fetchMessages = async () => {
      const { data, error } = await supabase.from("messages").select("*")

      if (error) {
        console.error("Error fetching messages:", error)
        return
      }

      const latestMessages: Record<string, { content: string; time: string }> = {}

      data.forEach((msg) => {
        const chatPartnerId = msg.sender_id !== session?.user?.id ? msg.sender_id : msg.receiver_id

        if (
          !latestMessages[chatPartnerId] ||
          new Date(msg.created_at) > new Date(latestMessages[chatPartnerId].time || "0")
        ) {
          latestMessages[chatPartnerId] = {
            content: msg.content,
            time: msg.created_at,
          }
        }
      })

      setLastMessages(latestMessages)
    }
    fetchMessages()

    const messageSubscription = supabase
      .channel("realtime-messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const newMsg = payload.new
        setLastMessages((prev) => {
          const chatPartnerId = newMsg.sender_id !== session?.user?.id ? newMsg.sender_id : newMsg.receiver_id

          return {
            ...prev,
            [chatPartnerId]: {
              content: newMsg.content,
              time: newMsg.created_at,
            },
          }
        })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(messageSubscription)
    }
  }, [session])

  const getSession = async () => {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession()

    if (error) {
      console.error("Error fetching session:", error)
      return
    }
    setSession(session)
  }

  useEffect(() => {
    getSession()
  }, [])

  useEffect(() => {
    if (!session?.user) return
    async function fetchCurrentUser() {
      if (!session || !session.user) {
        console.error("Session is null or user is undefined.")
        return
      }
      const { data, error } = await supabase
        .from("users")
        .select("id,name,email,created_at")
        .eq("id", session.user.id)
        .single()

      if (error) {
        console.error("Error fetching current user:", error)
        return
      }
      setCurrentUser(data)
    }
    fetchCurrentUser()
  }, [session])

  useEffect(() => {
    if (!currentUser) return

    async function fetchUsers() {
      const { data, error } = await supabase.from("users").select("id,name,email,created_at")

      if (error) {
        console.error("Error fetching users:", error)
        return
      }
      if (!currentUser) {
        console.error("Current user is null.")
        return
      }
      const filteredUsers = data.filter((user) => user.id !== currentUser.id)
      setUsers(filteredUsers)

      setLoading(false)
    }

    fetchUsers()
  }, [currentUser])

  useEffect(() => {
    if (users.length > 0) {
      const user = users.find((u) => u.id === slug)
      setSelectedUser(user || null)
    }
  }, [slug, users])

  const filteredUsers = users.filter((user) => user.name.toLowerCase().includes(searchQuery.toLowerCase()))

  const fetchUnreadUsers = async () => {
    if (!session?.user?.id) return

    try {
      const { data: unreadMessages, error } = await supabase
        .from("messages")
        .select("sender_id")
        .eq("receiver_id", session.user.id)
        .eq("read_status", false)

      if (error) throw error

      const unreadSenders = unreadMessages.map((msg) => msg.sender_id)

      const { data: unreadUsers, error: usersError } = await supabase.from("users").select("*").in("id", unreadSenders)

      if (usersError) throw usersError

      return unreadUsers || []
    } catch (error) {
      console.error("Error fetching unread users:", error)
      return []
    }
  }

  useEffect(() => {
    if (!selectedUser || !session?.user) return

    const markMessagesAsRead = async () => {
      await supabase
        .from("messages")
        .update({ read_status: true })
        .match({ sender_id: selectedUser.id, receiver_id: session.user.id, read_status: false })
    }
    markMessagesAsRead()
  }, [selectedUser, session])

  useEffect(() => {
    const fetchUsers = async () => {
      if (selected === "All") {
        setFilteredUsers(users)
      } else if (selected === "Unread") {
        const unreadUsers = await fetchUnreadUsers()
        setFilteredUsers(unreadUsers || [])
      }
    }
    fetchUsers()
  }, [selected, session, filteredUsers])

  const focusSearch = () => {
    if (searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-background">
        <div className="flex flex-col items-center animate-pulse-once">
          <MessageSquare size={48} className="text-primary mb-4" />
          <p className="text-lg font-medium">Loading your conversations...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background transition-colors duration-300 flex justify-center items-center p-0">
      <div className="w-full max-w-7xl p-4 md:p-8 lg:p-12 animate-fade-in">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl md:text-4xl font-bold">Your conversations</h2>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-full hover:bg-muted transition-colors duration-200"
            aria-label="Toggle dark mode"
          >
            {darkMode ? <Sun size={24} /> : <Moon size={24} />}
          </button>
        </div>

        <div className="relative w-full md:w-[40%] mb-6 animate-slide-up">
          <div
            className="flex items-center bg-card border border-border rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-primary focus-within:border-primary transition-all duration-200"
            onClick={focusSearch}
          >
            <span className="flex items-center justify-center px-3">
              <Search size={20} className="text-muted-foreground" />
            </span>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search your inbox"
              className="w-full py-3 px-2 bg-transparent placeholder:text-muted-foreground rounded-lg placeholder:font-medium outline-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="space-x-3 flex mb-6 animate-slide-up" style={{ animationDelay: "0.1s" }}>
          <button
            className={`px-6 py-2.5 text-md font-medium rounded-full transition-all duration-300 ${
              selected === "All"
                ? "bg-primary  shadow-lg shadow-primary/30"
                : "bg-card text-foreground hover:bg-muted"
            }
            ${
              darkMode ? "text-black":"text-black"
            }
            `}
            onClick={() => setSelected("All")}
          >
            All
          </button>
          <button
            className={`px-6 py-2.5 text-md font-medium rounded-full transition-all duration-300 flex items-center ${
              selected === "Unread"
                ? "bg-primary  shadow-lg shadow-primary/30"
                : "bg-card text-foreground hover:bg-muted"
            }
             ${
              darkMode ? "text-black":"text-white"
            }
            `}
            onClick={() => setSelected("Unread")}
          >
            <span>Unread</span>
            <Bell size={16} className="ml-2" />
          </button>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 animate-slide-up" style={{ animationDelay: "0.2s" }}>
          <div className="w-full lg:w-[40%] space-y-3">
            {(selected === "All" ? filteredUsers : FilteredUsers).map((user, index) => {
              const lastMsgData = lastMessages[user.id] || { content: "No messages yet", time: null }
              const hasUnreadMessages = false // You can implement this logic based on your data

              return (
                <div
                  key={user.id}
                  className={`relative border flex items-center p-4 rounded-xl cursor-pointer transition-all duration-300 animate-slide-up ${
                    user.id === slug ? "bg-primary/10 border-l-4 border-primary shadow-md" : "bg-card hover:bg-muted"
                  }`}
                  onClick={() => setSelectedUser(user)}
                  style={{ animationDelay: `${0.1 * index}s` }}
                >
                  <div className="relative ">
                    <Image
                      src="https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Warren_Buffett_at_the_2015_SelectUSA_Investment_Summit_%28cropped%29.jpg/220px-Warren_Buffett_at_the_2015_SelectUSA_Investment_Summit_%28cropped%29.jpg"
                      alt={user.name}
                      className="rounded-full w-[50px] h-[50px] object-cover border-2 border-border"
                    />
                    {hasUnreadMessages && (
                      <span className="absolute top-0 right-0 w-3 h-3 bg-accent rounded-full border-2 border-card"></span>
                    )}
                  </div>
                  <div className="ml-3 flex-1">
                    <div className="flex justify-between items-center">
                      <p className="font-semibold text-lg">{user.name}</p>
                      <span className="text-xs text-muted-foreground">
                        {lastMsgData.time
                          ? new Date(lastMsgData.time).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: true,
                            })
                          : ""}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-sm truncate mb-2">{lastMsgData.content}</p>
                    <div className="flex justify-between items-center">
                      <span className="bg-primary-dark text-white px-2 py-0.5 rounded-full text-xs">Travel Buddy</span>
                      <span className="text-muted-foreground">
                        <p className="text-xs">LA, USA to YVR, Canada</p>
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}

            {(selected === "All" ? filteredUsers : FilteredUsers).length === 0 && (
              <div className="flex flex-col items-center justify-center p-8 bg-card rounded-xl text-muted-foreground">
                <MessageSquare size={40} className="mb-2 opacity-50" />
                <p className="text-center">No conversations found</p>
              </div>
            )}
          </div>

          <div className="w-full lg:w-[60%] bg-card rounded-xl shadow-lg overflow-hidden border border-border">
            {selectedUser ? (
              <ChatBox session={session} selectedUser={selectedUser} />
            ) : (
              <div className="flex flex-col items-center justify-center h-[500px] text-muted-foreground">
                <MessageSquare size={48} className="mb-4 opacity-50" />
                <p className="text-xl font-medium mb-2">Start a conversation</p>
                <p>Select a user from the list to begin chatting</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ChatPage

