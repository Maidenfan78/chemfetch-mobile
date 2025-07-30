import React from 'react';
import {
    Modal,
    Pressable,
    Text,
    TextInput,
    View,
} from 'react-native';

interface SizePromptModalProps {
  visible: boolean;
  name: string;
  size: string;
  onChangeSize: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

export const SizePromptModal = ({
  visible,
  name,
  size,
  onChangeSize,
  onSave,
  onCancel,
}: SizePromptModalProps) => {
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View className="flex-1 bg-black/50 justify-center items-center">
        <View className="bg-white p-6 rounded-xl w-72">
          <Text className="text-center text-base text-dark-100 mb-3">
            Enter size/weight for <Text className="font-semibold">{name}</Text>
          </Text>
          <TextInput
            className="border border-gray-300 rounded-md px-3 py-2 mb-4 text-dark-100 bg-light-100"
            value={size}
            onChangeText={onChangeSize}
            placeholder="Size/weight"
            placeholderTextColor="#aaa"
          />
          <Pressable className="bg-primary py-2 rounded-lg mb-2" onPress={onSave}>
            <Text className="text-white text-center font-bold">Save</Text>
          </Pressable>
          <Pressable className="bg-gray-200 py-2 rounded-lg" onPress={onCancel}>
            <Text className="text-dark-100 text-center font-medium">Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};