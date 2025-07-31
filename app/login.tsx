// app/login.tsx
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Button, TextInput, View } from 'react-native';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return Alert.alert('Login failed', error.message);
    router.replace('/');
  };

  return (
    <View className="flex-1 justify-center p-6 bg-white">
      <TextInput placeholder="Email" value={email} onChangeText={setEmail} className="border p-2 mb-4" />
      <TextInput placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry className="border p-2 mb-4" />
      <Button title="Login" onPress={handleLogin} />
    </View>
  );
}
