// app/login.tsx
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Button, Pressable, Text, TextInput, View } from 'react-native';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  const handleAuth = async () => {
    const { data, error } = isRegistering
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

    console.log(isRegistering ? '📝 Register result:' : '📥 Login result:', { data, error });

    if (error) {
      Alert.alert(isRegistering ? 'Registration failed' : 'Login failed', error.message);
      return;
    }

    router.replace('/');
  };

  return (
    <View className="flex-1 justify-center p-6 bg-white">
      <Text className="text-2xl font-bold text-center mb-4">
        {isRegistering ? 'Create Account' : 'Login'}
      </Text>

      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        className="border px-4 py-3 mb-4 bg-light-100 rounded-md"
      />
      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        className="border px-4 py-3 mb-6 bg-light-100 rounded-md"
      />
      <Button title={isRegistering ? 'Sign Up' : 'Login'} onPress={handleAuth} />

      <Pressable onPress={() => setIsRegistering(!isRegistering)} className="mt-4">
        <Text className="text-center text-blue-600 font-medium">
          {isRegistering ? 'Already have an account? Login' : 'No account? Register'}
        </Text>
      </Pressable>
    </View>
  );
}
