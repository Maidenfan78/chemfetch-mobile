import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, Share, Text, View } from 'react-native';
import { BACKEND_API_URL } from '../lib/constants';
import { useProductStore } from '../lib/store';

export default function ResultsScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const setProduct = useProductStore((state) => state.setProduct);
  const clearProduct = useProductStore((state) => state.clear);
  const product = useProductStore((state) => state);

  useEffect(() => {
    if (!code) return;

    fetch(`${BACKEND_API_URL}/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.message) Alert.alert('Info', data.message);

        setProduct({
          barcode: code,
          name: data.product?.product_name || '',
          size: data.product?.contents_size_weight || '',
          sdsUrl: data.product?.sds_url || '',
        });

        if (!data.product?.sds_url && data.product?.product_name) {
          fetch(`${BACKEND_API_URL}/sds-by-name`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: data.product.product_name }),
          })
            .then((res) => res.json())
            .then((sds) => {
              if (sds.sdsUrl) setProduct({ sdsUrl: sds.sdsUrl });

            })
            .catch((err) => console.error('SDS fetch error', err));
        }

        setLoading(false);
      })
      .catch((err) => {
        console.error('Scan fetch error:', err);
        setLoading(false);
      });
  }, [code]);

  const shareSds = async () => {
    if (!product.sdsUrl) return;
    try {
      await Share.share({
        title: `SDS for ${product.name}`,
        message: product.sdsUrl,
        url: product.sdsUrl,
      });
    } catch (err) {
      console.error('Share error:', err);
    }
  };

  const downloadSds = () => {
    if (!product.sdsUrl) return;
    Linking.openURL(product.sdsUrl);
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#3A3D98" />
      </View>
    );
  }

  if (!product.name) {
    return (
      <View className="flex-1 justify-center items-center bg-white px-6">
        <Text className="text-lg text-center text-dark-100">No results found for {code}</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white p-6">
      <View className="border border-gray-200 rounded-xl p-4 bg-light-100 mb-6">
        <Text className="text-xl font-bold text-dark-100 mb-1">{product.name || 'Unknown product'}</Text>
        <Text className="text-dark-100">Size: {product.size || 'N/A'}</Text>
        {product.sdsUrl ? (
          <View className="mt-3 space-y-2">
            <Text className="text-accent">SDS: {product.sdsUrl}</Text>
            <Pressable className="bg-primary py-2 px-4 rounded-lg" onPress={shareSds}>
              <Text className="text-white font-semibold text-center">📤 Share SDS</Text>
            </Pressable>
            <Pressable className="bg-gray-700 py-2 px-4 rounded-lg" onPress={downloadSds}>
              <Text className="text-white font-semibold text-center">⬇️ Open in Browser</Text>
            </Pressable>
          </View>
        ) : (
          <Text className="text-dark-100 mt-2">No SDS link found</Text>
        )}
      </View>

      <Pressable
        className="bg-primary py-3 px-6 rounded-lg mb-4"
        onPress={() =>
router.push({
  pathname: './confirm',
  params: {
    code: code ?? '',
    name: product.name,
    size: product.size,
    editOnly: '1',
  },
})
        }
      >
        <Text className="text-white text-base font-bold text-center">✍️ Edit / Confirm Info</Text>
      </Pressable>

      <Pressable className="bg-gray-300 py-3 px-6 rounded-lg" onPress={() => router.replace('/')}
      >
        <Text className="text-dark-100 text-base font-semibold text-center">🔙 Back to Home</Text>
      </Pressable>
    </View>
  );
}
