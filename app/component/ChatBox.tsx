import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { Session } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
);

interface UserType {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

interface MessageType {
  id: string;
  content: string;
  sender_id: string;
  receiver_id: string;
  created_at: string;
}

interface ChatBoxProps {
  session: Session | null;
  selectedUser: UserType | null;
}

const ChatBox = ({ session, selectedUser }: ChatBoxProps) => {
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [newMessage, setNewMessage] = useState<string>("");
  const [onlineUsers, setOnlineUsers] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!session?.user?.id) return;

    const roomOne = supabase.channel("online-users", {
      config: { presence: { key: session.user.id } },
    });

    roomOne.on("presence", { event: "sync" }, () => {
      const presenceData = roomOne.presenceState();
      const formattedPresence: Record<string, boolean> = {};
      Object.keys(presenceData).forEach((userId) => {
        formattedPresence[userId] = true;
      });

      setOnlineUsers(formattedPresence);
    });

    roomOne.on("presence", { event: "join" }, ({ key }) => {
      setOnlineUsers((prev) => ({ ...prev, [key]: true }));
    });

    roomOne.on("presence", { event: "leave" }, ({ key }) => {
      setOnlineUsers((prev) => {
        const updatedState = { ...prev };
        delete updatedState[key];
        return updatedState;
      });
    });

    roomOne.subscribe(async (status) => {
      if (status !== "SUBSCRIBED") return;
      await roomOne.track({ online: true });
    });

    return () => {
      roomOne.unsubscribe();
    };
  }, [session]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedUser) return;

    const newMessageData = {
      content: newMessage,
      sender_id: session?.user.id,
      receiver_id: selectedUser.id,
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("messages").insert([newMessageData]);

    if (error) {
      console.error("Error sending message:", error);
      return;
    }

    setNewMessage(""); 
  };

  useEffect(() => {
    if (!session?.user?.id || !selectedUser) return;

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .or(
          `and(sender_id.eq.${session.user.id},receiver_id.eq.${selectedUser.id}),and(sender_id.eq.${selectedUser.id},receiver_id.eq.${session.user.id})`
        )
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching messages:", error);
        return;
      }

      setMessages(data as MessageType[]);
    };

    fetchMessages();

    const messageSubscription = supabase
      .channel("realtime-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const newMsg = payload.new as MessageType;
          
          // Only add message if it's between the selected users
          if (
            (newMsg.sender_id === session?.user.id &&
              newMsg.receiver_id === selectedUser.id) ||
            (newMsg.sender_id === selectedUser.id &&
              newMsg.receiver_id === session?.user.id)
          ) {
            setMessages((prevMessages) => [...prevMessages, newMsg]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messageSubscription);
    };
  }, [session, selectedUser]);

  return (
    <div className="bg-white rounded-xl">
      {selectedUser ? (
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center">
            <img
              src="https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Warren_Buffett_at_the_2015_SelectUSA_Investment_Summit_%28cropped%29.jpg/220px-Warren_Buffett_at_the_2015_SelectUSA_Investment_Summit_%28cropped%29.jpg"
              alt="User"
              className="rounded-full w-[50px] h-[50px]"
            />
            <span className="ml-4">
              <p className="font-medium text-2xl">{selectedUser.name}</p>
              <p className="text-base text-gray-500">
                {onlineUsers[selectedUser.id] ? "Online" : "Offline"}
              </p>
            </span>
          </div>
          <a className="text-blue-500 font-medium cursor-pointer">View details</a>
        </div>
      ) : (
        <p className="p-4 text-center">Select a user to start chatting</p>
      )}

      <div className="bg-slate-100 p-4 mt-4 rounded-xl flex-grow h-[408px] overflow-y-scroll no-scrollbar">
        {messages.map((msg) => {
          const isSender = msg.sender_id === session?.user.id;

          return (
            <div
              key={msg.id || msg.created_at}
              className={`flex ${isSender ? "justify-end" : "justify-start"} my-1`}
            >
              <div
                className={`p-3 rounded-xl max-w-[60%] ${
                  isSender ? "bg-blue-500 text-white" : "bg-white text-black"
                }`}
                style={{
                  borderRadius: isSender
                    ? "16px 16px 0px 16px"
                    : "16px 16px 16px 0px",
                }}
              >
                <p className="break-words">{msg.content}</p>
                <span className="text-xs text-gray-500 block text-right">
                  {new Date(msg.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 p-4 border-t">
        <input
          type="text"
          placeholder="Type your message..."
          className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-400 focus:outline-none bg-white"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />
      </div>
    </div>
  );
};

export default ChatBox;
