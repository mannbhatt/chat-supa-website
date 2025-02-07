"use client";

import { useState,useEffect } from "react";
import { Supabase } from "./utils/supabaseClient";
import { useRouter } from "next/navigation";
import { cookies } from 'next/headers'
const AuthPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name,setname]=useState("")  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  
  const router = useRouter();

 
  const handleSignUp = async () => {
    setLoading(true);
    setError("");
    const {data, error } = await Supabase.auth.signUp({ email, password });
    setLoading(false);
    //console.log(data);
    if (data?.user?.id) {
      const { error: insertError } = await Supabase.from("users").insert([
        {
          id: data.user.id, 
          email:email,
          name:name,
        },
      ]);
  
      if (insertError) {
        console.error("⚠️ Error inserting user:", insertError);
        
      }
    } else {
      console.error("⚠️ User ID missing after signup");
       
    }
    
    if (error) {
      setError(error.message);
    } else {
      alert("Check your email for verification!");

    }
  };

 
 

 
  const handleSignIn = async () => {
    setLoading(true);
    setError("");

    try {
      const { data, error } = await Supabase.auth.signInWithPassword({ email, password });
      

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      
      if (!data?.user) {
        setError("Login failed, user not found.");
        setLoading(false);
        return;
      }


      


      document.cookie = `supabase-session=${data.session?.access_token}; path=/`;


      router.push(`/chat/${data.user.id}`);

    } catch (err) {
      setError("Something went wrong. Please try again.");
      console.error("Login Error:", err);
    } finally {
      setLoading(false);

    }
  };



  
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Login / Sign Up</h1>


      <input
        type="email"
        placeholder="Email"
        className="border p-2 mb-2 w-64"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="text"
        placeholder="name"
        className="border p-2 mb-2 w-64"
        value={name}
        onChange={(e) => setname(e.target.value)}
      />

      

      <input
        type="password"
        placeholder="Password"
        className="border p-2 mb-2 w-64"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />


      {error && <p className="text-red-500">{error}</p>}


      <button
        className="bg-blue-500 text-white px-4 py-2 rounded w-64 mt-2"
        onClick={handleSignIn}
        disabled={loading}
      >
        {loading ? "Logging in..." : "Sign In"}
      </button>

      <button
        className="bg-green-500 text-white px-4 py-2 rounded w-64 mt-2"
        onClick={handleSignUp}
        disabled={loading}
      >
        {loading ? "Signing up..." : "Sign Up"}
      </button>
      
    </div>
  );
};

export default AuthPage;
