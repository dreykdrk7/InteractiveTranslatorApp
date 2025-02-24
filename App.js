import React, { useState, useEffect, useRef } from 'react';
import { View, TextInput, Text, TouchableOpacity, ActivityIndicator, StyleSheet, useColorScheme, StatusBar, Platform } from 'react-native';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import { Picker } from '@react-native-picker/picker';
import { getLocales } from 'expo-localization';
import axios from 'axios';
import privateApiKey from './config/api_key.json';
import { MaterialIcons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';

const GOOGLE_TRANSLATE_API_KEY = privateApiKey.key;

const languageMapping = {
  es: 'es-ES',
  en: 'en-US',
};

export default function TranslatorApp() {
  const [text, setText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [sourceLang, setSourceLang] = useState(getLocales()[0]?.language || 'es');
  const [targetLang, setTargetLang] = useState('en');
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState(null);
  const recordingRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [availableLanguages, setAvailableLanguages] = useState([]);
  const colorScheme = useColorScheme();

  useEffect(() => {
    async function fetchLanguages() {
      try {
        const response = await axios.get('https://translation.googleapis.com/language/translate/v2/languages', {
          params: {
            key: GOOGLE_TRANSLATE_API_KEY,
            target: 'es'
          }
        });
        let languages = response.data.data.languages;
        const spanish = languages.find(lang => lang.language === 'es');
        const english = languages.find(lang => lang.language === 'en');
        const others = languages.filter(lang => lang.language !== 'es' && lang.language !== 'en');
        const orderedLanguages = [];
        if (spanish) orderedLanguages.push(spanish);
        if (english) orderedLanguages.push(english);
        orderedLanguages.push(...others);
        setAvailableLanguages(orderedLanguages);
      } catch (error) {
        console.error('Error al cargar los idiomas:', error);
      }
    }
    fetchLanguages();
  }, []);

  const translateText = async () => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const response = await axios.post(
        `https://translation.googleapis.com/language/translate/v2`,
        null,
        {
          params: {
            q: text,
            source: sourceLang,
            target: targetLang,
            format: 'text',
            key: GOOGLE_TRANSLATE_API_KEY,
          },
        }
      );
      setTranslatedText(response.data.data.translations[0].translatedText);
    } catch (error) {
      console.error('Error al traducir:', error);
    } finally {
      setLoading(false);
    }
  };

  const swapLanguages = () => {
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
    setText(translatedText);
    setTranslatedText(text);
  };

  const transcribeAudio = async (audioUri) => {
    try {
      setLoading(true);
      
      const file = await FileSystem.readAsStringAsync(audioUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
  
      const response = await axios.post(
        `https://speech.googleapis.com/v1/speech:recognize?key=${GOOGLE_TRANSLATE_API_KEY}`,
        {
          config: {
            encoding: "LINEAR16",
            sampleRateHertz: 16000,
            languageCode: languageMapping[sourceLang] || 'es-ES',
          },
          audio: {
            content: file,
          },
        }
      );
  
      const transcription = response.data.results[0]?.alternatives[0]?.transcript;
      if (transcription) {
        setText(transcription);
        translateText();
      }
  
    } catch (error) {
      console.error('Error en la transcripción:', error.response?.data || error.message);
    } finally {
      setLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        console.warn('Permiso de micrófono denegado');
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY
      );
      recordingRef.current = recording;
      setIsRecording(true);
    } catch (error) {
      console.error('Error al iniciar grabación:', error);
    }
  };

  const stopRecording = async () => {
    try {
      setIsRecording(false);
      if (recordingRef.current) {
        await recordingRef.current.stopAndUnloadAsync();
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
        });
        const uri = recordingRef.current.getURI();
        console.log('Grabación guardada en:', uri);
        recordingRef.current = null;

        await transcribeAudio(uri);
      }
    } catch (error) {
      console.error('Error al detener la grabación:', error);
    }
  };

  const speakTranslation = () => {
    if (translatedText) {
      Speech.speak(translatedText, { language: targetLang });
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      padding: 20,
      paddingTop: StatusBar.currentHeight || 20,
      backgroundColor: '#d9d9d6',
      justifyContent: 'center',
    },
    textInput: {
      borderWidth: 1,
      padding: 10,
      marginBottom: 10,
      color: '#565655',
      backgroundColor: '#adadab',
      borderRadius: 10,
      borderColor: '#6c6c6b',
    },
    buttonRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginVertical: 20,
    },
    iconSwap: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#979795',
      padding: 10,
      borderRadius: 50,
      marginHorizontal: 5,
    },
    iconButton: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#6c6c6b',
      padding: 20,
      borderRadius: 50,
      marginHorizontal: 5,
    },
    translateButton: {
      backgroundColor: '#007AFF',
      padding: 15,
      borderRadius: 20,
      alignItems: 'center',
      marginTop: 10,
      marginBottom: 20,
    },
    translateButtonText: {
      color: '#f7f7f6',
      fontSize: 16,
      fontWeight: 'bold',
    },
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Introduce el texto o usa el micrófono"
        style={styles.textInput}
      />
      <Picker selectedValue={sourceLang} onValueChange={(itemValue) => setSourceLang(itemValue)}>
        {availableLanguages.map(lang => (
          <Picker.Item
            key={lang.language}
            label={(lang.name || lang.language).charAt(0).toUpperCase() + (lang.name || lang.language).slice(1)}
            value={lang.language}
          />
        ))}
      </Picker>
      <TouchableOpacity onPress={swapLanguages} style={styles.iconSwap}>
        <MaterialIcons name="swap-horiz" size={32} color="#FFFFFF" />
      </TouchableOpacity>
      <Picker selectedValue={targetLang} onValueChange={(itemValue) => setTargetLang(itemValue)}>
        {availableLanguages.map(lang => (
          <Picker.Item
            key={lang.language}
            label={(lang.name || lang.language).charAt(0).toUpperCase() + (lang.name || lang.language).slice(1)}
            value={lang.language}
          />
        ))}
      </Picker>
      <TouchableOpacity style={styles.translateButton} onPress={translateText}>
        <Text style={styles.translateButtonText}>Traducir</Text>
      </TouchableOpacity>
      {loading && <ActivityIndicator size="large" color="#007AFF" />}
      <TextInput
        value={translatedText}
        editable={false}
        style={styles.textInput}
      />
      <View style={styles.buttonRow}>
        <TouchableOpacity onPress={isRecording ? stopRecording : startRecording} style={styles.iconButton}>
          <MaterialIcons name="mic" size={32} color={isRecording ? 'red' : '#FFFFFF'} />
        </TouchableOpacity>
        <TouchableOpacity onPress={speakTranslation} style={styles.iconButton}>
          <MaterialIcons name="volume-up" size={32} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}
