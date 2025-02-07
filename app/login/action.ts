'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { supabaseServer} from '../utils/supabase/server'


export async function login(formData: FormData) {
  const supabase = await supabaseServer()
  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    redirect('/error')
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function signup(formData: FormData) {
  const supabase = await supabaseServer();
    
  const user = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
        
  }

  const { data,error } = await supabase.auth.signUp(user)

  if (error) {
    redirect('/error')
  }
  
  revalidatePath('/', 'layout')
  redirect('/')
}