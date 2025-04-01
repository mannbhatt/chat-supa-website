"use client"

import { useState, useEffect, useRef } from "react"
import { createClient } from "@supabase/supabase-js"
import type { Session } from "@supabase/supabase-js"
import { Send, Phone, Video, Info, Smile } from "lucide-react"
import { Palanquin_Dark } from "next/font/google"

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

interface MessageType {
  id: string
  content: string
  sender_id: string
  receiver_id: string
  created_at: string
}

interface ChatBoxProps {
  session: Session | null
  selectedUser: UserType | null
}

const ChatBox = ({ session, selectedUser }: ChatBoxProps) => {
  const [messages, setMessages] = useState<MessageType[]>([])
  const [newMessage, setNewMessage] = useState<string>("")
  const [onlineUsers, setOnlineUsers] = useState<Record<string, boolean>>({})
  const [isSending, setIsSending] = useState<boolean>(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!session?.user?.id) return

    const roomOne = supabase.channel("online-users", {
      config: { presence: { key: session.user.id } },
    })

    roomOne.on("presence", { event: "sync" }, () => {
      const presenceData = roomOne.presenceState()
      const formattedPresence: Record<string, boolean> = {}
      Object.keys(presenceData).forEach((userId) => {
        formattedPresence[userId] = true
      })

      setOnlineUsers(formattedPresence)
    })

    roomOne.on("presence", { event: "join" }, ({ key }) => {
      setOnlineUsers((prev) => ({ ...prev, [key]: true }))
    })

    roomOne.on("presence", { event: "leave" }, ({ key }) => {
      setOnlineUsers((prev) => {
        const updatedState = { ...prev }
        delete updatedState[key]
        return updatedState
      })
    })

    roomOne.subscribe(async (status) => {
      if (status !== "SUBSCRIBED") return
      await roomOne.track({ online: true })
    })

    return () => {
      roomOne.unsubscribe()
    }
  }, [session])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedUser || !session?.user?.id) return

    setIsSending(true)

    const newMessageData = {
      content: newMessage,
      sender_id: session.user.id,
      receiver_id: selectedUser.id,
      created_at: new Date().toISOString(),
    }

    const { error } = await supabase.from("messages").insert([newMessageData])

    if (error) {
      console.error("Error sending message:", error)
    }

    setNewMessage("")
    setIsSending(false)
  }

  useEffect(() => {
    if (!session?.user?.id || !selectedUser) return

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .or(
          `and(sender_id.eq.${session.user.id},receiver_id.eq.${selectedUser.id}),and(sender_id.eq.${selectedUser.id},receiver_id.eq.${session.user.id})`,
        )
        .order("created_at", { ascending: true })

      if (error) {
        console.error("Error fetching messages:", error)
        return
      }

      setMessages(data as MessageType[])
    }

    fetchMessages()

    const messageSubscription = supabase
      .channel("realtime-messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const newMsg = payload.new as MessageType

        // Only add message if it's between the selected users
        if (
          (newMsg.sender_id === session?.user.id && newMsg.receiver_id === selectedUser.id) ||
          (newMsg.sender_id === selectedUser.id && newMsg.receiver_id === session?.user.id)
        ) {
          setMessages((prevMessages) => [...prevMessages, newMsg])
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(messageSubscription)
    }
  }, [session, selectedUser])

  const formatMessageDate = (dateString: string) => {
    const messageDate = new Date(dateString)
    const today = new Date()

    // Check if message is from today
    if (messageDate.toDateString() === today.toDateString()) {
      return messageDate.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    }

    // Check if message is from yesterday
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    if (messageDate.toDateString() === yesterday.toDateString()) {
      return `Yesterday, ${messageDate.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}`
    }

    // Otherwise return full date
    return (
      messageDate.toLocaleDateString([], {
        month: "short",
        day: "numeric",
      }) +
      ", " +
      messageDate.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    )
  }

  const groupMessagesByDate = () => {
    const groups: { date: string; messages: MessageType[] }[] = []
    let currentDate = ""
    let currentGroup: MessageType[] = []

    messages.forEach((message) => {
      const messageDate = new Date(message.created_at).toLocaleDateString()

      if (messageDate !== currentDate) {
        if (currentGroup.length > 0) {
          groups.push({ date: currentDate, messages: currentGroup })
        }
        currentDate = messageDate
        currentGroup = [message]
      } else {
        currentGroup.push(message)
      }
    })

    if (currentGroup.length > 0) {
      groups.push({ date: currentDate, messages: currentGroup })
    }

    return groups
  }

  const messageGroups = groupMessagesByDate()

  return (
    <div className="flex flex-col h-full">
      {selectedUser ? (
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center">
            <div className="relative">
              <img
                src="https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Warren_Buffett_at_the_2015_SelectUSA_Investment_Summit_%28cropped%29.jpg/220px-Warren_Buffett_at_the_2015_SelectUSA_Investment_Summit_%28cropped%29.jpg"
                alt={selectedUser.name}
                className="rounded-full w-[50px] h-[50px] object-cover border-2 border-border"
              />
              {onlineUsers[selectedUser.id] && (
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-secondary rounded-full border-2 border-card"></span>
              )}
            </div>
            <div className="ml-4">
              <p className="font-semibold text-xl">{selectedUser.name}</p>
              <p className={`text-sm ${onlineUsers[selectedUser.id] ? "text-secondary" : "text-muted-foreground"}`}>
                {onlineUsers[selectedUser.id] ? "Online" : "Offline"}
              </p>
            </div>
          </div>
          <div className="flex space-x-2">
            <button className="p-2 rounded-full hover:bg-muted transition-colors duration-200" aria-label="Call">
              <Phone size={20} />
            </button>
            <button className="p-2 rounded-full hover:bg-muted transition-colors duration-200" aria-label="Video call">
              <Video size={20} />
            </button>
            <button className="p-2 rounded-full hover:bg-muted transition-colors duration-200" aria-label="Info">
              <Info size={20} />
            </button>
          </div>
        </div>
      ) : (
        <p className="p-4 text-center">Select a user to start chatting</p>
      )}

      <div className="bg-muted p-4 flex-grow h-[408px] overflow-y-auto no-scrollbar">
        {messageGroups.map((group, groupIndex) => (
          <div key={group.date} className="mb-4">
            <div className="flex justify-center mb-4">
              <span className="px-3 py-1 bg-muted-foreground/20 rounded-full text-xs text-muted-foreground">
                {new Date(group.date).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
              </span>
            </div>

            {group.messages.map((msg, msgIndex) => {
              const isSender = msg.sender_id === session?.user?.id
              const isFirstInSequence = msgIndex === 0 || group.messages[msgIndex - 1].sender_id !== msg.sender_id
              const isLastInSequence =
                msgIndex === group.messages.length - 1 || group.messages[msgIndex + 1].sender_id !== msg.sender_id

              return (
                <div
                  key={msg.id || msg.created_at}
                  className={`flex ${isSender ? "justify-end " : "justify-start"} ${isFirstInSequence ? "mt-4" : "mt-1 ml-10"}`}
                >
                  {!isSender && isFirstInSequence && (
                    <img
                      src="https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Warren_Buffett_at_the_2015_SelectUSA_Investment_Summit_%28cropped%29.jpg/220px-Warren_Buffett_at_the_2015_SelectUSA_Investment_Summit_%28cropped%29.jpg"
                      
                      className="w-8 h-8 rounded-full mr-2 mt-1"
                    />
                  )}
                  <div
                    className={`p-3  max-w-[70%] ${
                      isFirstInSequence ? "":""
                    }${
                      isSender ? "message-bubble-out bg-muted-foreground/20 rounded-lg" : "message-bubble-in bg-muted-foreground/20 rounded-lg"
                    } ${msgIndex === 0 ? "animate-fade-in" : ""}
                    `}
                  >
                    <p className="break-words">{msg.content}</p>
                    <span
                      className={`text-xs block text-right mt-1 ${isSender ? " text-muted-foreground" : "text-muted-foreground"}`}
                    >
                      {formatMessageDate(msg.created_at)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-border">
        <div className="flex items-center bg-muted-foreground/20 rounded-full overflow-hidden transition-all duration-300 focus-within:ring-2 focus-within:ring-primary">
          <button className="p-2 ml-2 text-muted-foreground hover:text-foreground transition-colors">
            <Smile size={20} />
          </button>
          <input
            type="text"
            placeholder="Type your message..."
            className="w-full p-3 bg-transparent placeholder:text-muted-foreground focus:outline-none"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
          />
          <button
            onClick={sendMessage}
            disabled={!newMessage.trim() || isSending}
            className={`p-3 rounded-full transition-all duration-300 ${
              newMessage.trim() && !isSending
                ? "bg-primary text-black hover:bg-primary-dark"
                : "bg-muted-foreground/30 text-muted-foreground cursor-not-allowed"
            }`}
          >
            <Send size={20} className={isSending ? "animate-pulse bg-black" : ""} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default ChatBox

