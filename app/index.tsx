// app/index.tsx
import React, { useEffect } from "react";
import { Text, View } from "react-native";
import { supabase } from "../lib/supabase";



export default function HomeScreen() {
  useEffect(() => {
    async function checkConnection() {
      const { data, error } = await supabase.from("product").select("*").limit(1);
      console.log("Test query:", data, error);
    }
    checkConnection();
  }, []);

  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-xl font-bold">ChemFetch Mobile</Text>
    </View>
  );
}
