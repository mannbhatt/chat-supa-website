"use client";
import { Session, User } from "@supabase/supabase-js";
import { useRouter, useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import ChatBox from "@/app/component/ChatBox";

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
interface LastMessageType {
  content: string;
  time: string | null;
}

const ChatPage = () => {
  const router = useRouter();
  const params = useParams();
  const slug = params?.slug;


  const [session, setSession] = useState<Session | null>(null);
  const [users, setUsers] = useState<UserType[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [selected, setSelected] = useState<string>("All");
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [FilteredUsers, setFilteredUsers] = useState<any[]>([]);
  const [lastMessages, setLastMessages] = useState<Record<string, LastMessageType>>({});

  useEffect(() => {
    const fetchMessages = async () => {
      const { data, error } = await supabase.from("messages").select("*");

      if (error) {
        console.error("Error fetching messages:", error);
        return;
      }

      const latestMessages: Record<string, { content: string; time: string }> = {};

      data.forEach((msg) => {
        const chatPartnerId =
          msg.sender_id !== session?.user?.id ? msg.sender_id : msg.receiver_id;

        if (!latestMessages[chatPartnerId] || new Date(msg.created_at) > new Date(latestMessages[chatPartnerId].time || 0)) {
          latestMessages[chatPartnerId] = {
            content: msg.content,
            time: msg.created_at,
          };
        }
      });

      setLastMessages(latestMessages);
    };
    fetchMessages();




    const messageSubscription = supabase
      .channel("realtime-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const newMsg = payload.new;
          setLastMessages((prev) => {
            const chatPartnerId =
              newMsg.sender_id !== session?.user?.id ? newMsg.sender_id : newMsg.receiver_id;

            return {
              ...prev,
              [chatPartnerId]: {
                content: newMsg.content,
                time: newMsg.created_at,
              },
            };
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messageSubscription);
    };
  }, [session]);







  const getSession = async () => {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      console.error("Error fetching session:", error);
      return;
    }
    setSession(session);
  };

  useEffect(() => {
    getSession();
  }, []);

  useEffect(() => {
    if (!session?.user) return;
    async function fetchCurrentUser() {
      if (!session || !session.user) {
        console.error("Session is null or user is undefined.");
        return;
      }
      const { data, error } = await supabase
        .from("users")
        .select("id,name,email,created_at")
        .eq("id", session.user.id)
        .single();

      if (error) {
        console.error("Error fetching current user:", error);
        return;
      }
      setCurrentUser(data);
    }
    fetchCurrentUser();
  }, [session]);


  useEffect(() => {
    if (!currentUser) return;

    async function fetchUsers() {
      const { data, error } = await supabase
        .from("users")
        .select("id,name,email,created_at");

      if (error) {
        console.error("Error fetching users:", error);
        return;
      }
      if (!currentUser) {
        console.error("Current user is null.");
        return;
      }
      const filteredUsers = data.filter((user) => user.id !== currentUser.id);
      setUsers(filteredUsers);


      setLoading(false);
    }

    fetchUsers();
  }, [currentUser]);




  useEffect(() => {
    if (users.length > 0) {
      const user = users.find((u) => u.id === slug);
      setSelectedUser(user || null);
    }
  }, [slug, users]);

  const filteredUsers = users.filter((user) =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  
  
  
  const fetchUnreadUsers = async () => {
    if (!session?.user?.id) return;

    try {

      const { data: unreadMessages, error } = await supabase
        .from("messages")
        .select("sender_id")
        .eq("receiver_id", session.user.id)
        .eq("read_status", false);

      if (error) throw error;

      const unreadSenders = unreadMessages.map((msg) => msg.sender_id);

      const { data: unreadUsers, error: usersError } = await supabase
        .from("users")
        .select("*")
        .in("id", unreadSenders);

      if (usersError) throw usersError;

      return unreadUsers || [];

    } catch (error) {
      console.error("Error fetching unread users:", error);
      return [];
    }
  };





  useEffect(() => {
    if (!selectedUser || !session?.user) return;

    const markMessagesAsRead = async () => {
      await supabase
        .from("messages")
        .update({ read_status: true })
        .match({ sender_id: selectedUser.id, receiver_id: session.user.id, read_status: false });
    };
    markMessagesAsRead();
  }, [selectedUser, session]);





  useEffect(() => {
    const fetchUsers = async () => {
      

      if (selected === "All") {
        filteredUsers

      } else if (selected === "Unread") {
        const unreadUsers = await fetchUnreadUsers();
        setFilteredUsers(unreadUsers || []);
        ;

      }
      
    };
    fetchUsers();
  }, [selected, session]);



  if (loading) {
    return <div>Loading...</div>;
  }


  return (
    <div className="min-h-screen bg-slate-100 flex justify-center items-center p-0">
      <div className="w-full p-12">
        <h2 className="text-4xl font-semibold mb-6">Your conversations</h2>

        <div className="flex w-[40%] h-10 mb-6  bg-white border border-gray-300 rounded-lg focus-within:border-gray-300">
          <span className="flex items-center justify-center px-2"><svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="22" height="22" viewBox="0 0 30 30">
            <path d="M 13 3 C 7.4889971 3 3 7.4889971 3 13 C 3 18.511003 7.4889971 23 13 23 C 15.396508 23 17.597385 22.148986 19.322266 20.736328 L 25.292969 26.707031 A 1.0001 1.0001 0 1 0 26.707031 25.292969 L 20.736328 19.322266 C 22.148986 17.597385 23 15.396508 23 13 C 23 7.4889971 18.511003 3 13 3 z M 13 5 C 17.430123 5 21 8.5698774 21 13 C 21 17.430123 17.430123 21 13 21 C 8.5698774 21 5 17.430123 5 13 C 5 8.5698774 8.5698774 5 13 5 z" fill="#9CA3AF"></path>
          </svg></span>
          <input
            type="text"
            placeholder="Search your inbox"
            className="w-full py-2  placeholder:text-gray-400 rounded-lg placeholder:font-medium outline-none"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="space-x-3 bg-white mb-4 rounded-full w-fit">
          <button
            className={`px-6 py-2 text-md font-medium rounded-full transition-all duration-300 ${selected === "All" ? "bg-black shadow text-white" : "bg-white text-gray-900 hover:bg-gray-50"}`}
            onClick={() => setSelected("All")}
          >
            All
          </button>
          <button
            className={`px-4 py-2 text-md font-medium rounded-full transition-all duration-300 ${selected === "Unread" ? "bg-black shadow text-white" : "bg-white text-gray-900 hover:bg-gray-50"}`}
            onClick={() => setSelected("Unread")}
          >
            Unread
          </button>

        </div>

        <div className="flex ">
          <div className="w-[50%] border-gray-300 space-y-3 pr-3">
            {(selected === "All" ? filteredUsers : FilteredUsers).map((user) => {
              const lastMsgData = lastMessages[user.id] || { content: "No messages yet", time: null };

              return (
                <div
                  key={user.id}
                  className={`relative flex items-center p-3 shadow rounded-xl bg-white cursor-pointer hover:bg-gray-100 ${user.id === slug ? "border border-black" : ""
                    }`}
                  onClick={() => setSelectedUser(user)}
                >
                  <img
                    src={
                      "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Warren_Buffett_at_the_2015_SelectUSA_Investment_Summit_%28cropped%29.jpg/220px-Warren_Buffett_at_the_2015_SelectUSA_Investment_Summit_%28cropped%29.jpg"
                      }
                    alt="User"
                    className="rounded-full w-[50px] h-[50px]"
                  />
                  <div className="ml-3 flex-1">
                    <div className="flex justify-between items-center"><p className="font-medium text-xl mb-1">{user.name} </p>
                    <span className=" text-xs text-gray-400">
                    <p>{lastMsgData.time
                      ? new Date(lastMsgData.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true })
                      : ""}</p></span>
</div>
                    <p className=" text-gray-500 text-base font-light truncate mb-2">{lastMsgData.content}</p>
                    <div className="flex justify-between items-center"><span className="bg-blue-800 text-white px-2 rounded-full w-fit"><p className="text-base">Travel Buddy</p></span>
                    <span className="  text-gray-400">
                  <p className="text-xs">LA,USA to YVR , Canada
                  </p>                </span>
                </div>
                
                
                  </div>

                </div>
              )
            })}
          </div>


          <div className="w-full px-8 py-4 shadow bg-white rounded-xl">
            {selectedUser ? (
              <ChatBox session={session} selectedUser={selectedUser} />
            ) : (
              <div className="flex justify-center "><p>Please select a user to chat with</p></div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
export default ChatPage;
