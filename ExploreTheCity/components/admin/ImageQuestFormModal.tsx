import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

interface ImageQuestFormModalProps {
  visible: boolean;
  latitude: number;
  longitude: number;
  onClose: () => void;
  onSubmit: (data: {
    latitude: number;
    longitude: number;
    description: string;
    imageUri: string;
    score: number;
    questRadius: number;
  }) => Promise<void>;
  editMode?: boolean;
  existingQuest?: {
    id: string;
    description: string;
    imageUrl: string;
    score: number;
    questRadius: number;
  } | null;
}

export default function ImageQuestFormModal({
  visible,
  latitude,
  longitude,
  onClose,
  onSubmit,
  editMode = false,
  existingQuest = null,
}: ImageQuestFormModalProps) {
  const [description, setDescription] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [score, setScore] = useState("100");
  const [questRadius, setQuestRadius] = useState("100");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize with existing quest data if in edit mode
  React.useEffect(() => {
    if (editMode && existingQuest) {
      setDescription(existingQuest.description);
      setImageUri(existingQuest.imageUrl);
      setScore(existingQuest.score.toString());
      setQuestRadius(existingQuest.questRadius.toString());
    } else {
      setDescription("");
      setImageUri(null);
      setScore("100");
      setQuestRadius("100");
    }
  }, [editMode, existingQuest, visible]);

  const pickImage = async () => {
    // Request permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Please grant access to your photo library to upload images."
      );
      return;
    }

    // Launch image picker
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    // Request permission
    const { status } = await ImagePicker.requestCameraPermissionsAsync();

    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Please grant access to your camera to take photos."
      );
      return;
    }

    // Launch camera
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!description.trim()) {
      Alert.alert("Validation Error", "Please enter a description.");
      return;
    }

    if (!imageUri) {
      Alert.alert("Validation Error", "Please select an image.");
      return;
    }

    const scoreValue = parseInt(score);
    if (isNaN(scoreValue) || scoreValue <= 0) {
      Alert.alert("Validation Error", "Please enter a valid score (positive number).");
      return;
    }

    const radiusValue = parseInt(questRadius);
    if (isNaN(radiusValue) || radiusValue <= 0) {
      Alert.alert("Validation Error", "Please enter a valid radius (positive number in meters).");
      return;
    }

    setIsSubmitting(true);

    try {
      console.log("Submitting image quest:", { latitude, longitude, description, imageUri, score: scoreValue, questRadius: radiusValue });

      await onSubmit({
        latitude,
        longitude,
        description: description.trim(),
        imageUri,
        score: scoreValue,
        questRadius: radiusValue,
      });

      // Reset form
      setDescription("");
      setImageUri(null);
      setScore("100");
      setQuestRadius("100");
      onClose();

      Alert.alert("Success", "Image quest created successfully!");
    } catch (error: any) {
      console.error("Image quest creation error:", error);
      const errorMessage = error?.message || "Failed to create image quest. Please try again.";
      Alert.alert("Error", errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setDescription("");
      setImageUri(null);
      setScore("100");
      setQuestRadius("100");
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              <Text style={styles.title}>
                {editMode ? "Edit Image Quest" : "Create Image Quest"}
              </Text>

              {/* Coordinates Display */}
              <View style={styles.coordinatesContainer}>
                <Text style={styles.coordinatesLabel}>Coordinates:</Text>
                <Text style={styles.coordinatesText}>
                  Lat: {latitude.toFixed(6)}, Lng: {longitude.toFixed(6)}
                </Text>
              </View>

              {/* Image Upload */}
              <View style={styles.section}>
                <Text style={styles.label}>Reference Image *</Text>
                <Text style={styles.helperText}>
                  This image will be compared with user photos using AI
                </Text>
                {imageUri ? (
                  <View style={styles.imageContainer}>
                    <Image source={{ uri: imageUri }} style={styles.image} />
                    <TouchableOpacity
                      style={styles.changeImageButton}
                      onPress={pickImage}
                    >
                      <Text style={styles.changeImageText}>Change Image</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.imagePickerButtons}>
                    <TouchableOpacity
                      style={styles.imageButton}
                      onPress={takePhoto}
                    >
                      <Text style={styles.imageButtonText}>📷 Take Photo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.imageButton}
                      onPress={pickImage}
                    >
                      <Text style={styles.imageButtonText}>🖼️ Choose from Library</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Description Input */}
              <View style={styles.section}>
                <Text style={styles.label}>Description *</Text>
                <Text style={styles.helperText}>
                  Describe what users should photograph
                </Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="E.g., Take a photo of the Eiffel Tower"
                  placeholderTextColor="#999999"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  maxLength={300}
                />
              </View>

              {/* Score Input */}
              <View style={styles.section}>
                <Text style={styles.label}>Score (Points) *</Text>
                <Text style={styles.helperText}>
                  Points awarded when quest is completed
                </Text>
                <TextInput
                  style={styles.input}
                  value={score}
                  onChangeText={setScore}
                  placeholder="100"
                  placeholderTextColor="#999999"
                  keyboardType="numeric"
                />
              </View>

              {/* Quest Radius Input */}
              <View style={styles.section}>
                <Text style={styles.label}>Quest Radius (meters) *</Text>
                <Text style={styles.helperText}>
                  Users must be within this distance to attempt the quest
                </Text>
                <TextInput
                  style={styles.input}
                  value={questRadius}
                  onChangeText={setQuestRadius}
                  placeholder="100"
                  placeholderTextColor="#999999"
                  keyboardType="numeric"
                />
              </View>

              {/* Action Buttons */}
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={handleClose}
                  disabled={isSubmitting}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.submitButton,
                    isSubmitting && styles.submitButtonDisabled,
                  ]}
                  onPress={handleSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.submitButtonText}>
                      {editMode ? "Update Quest" : "Create Quest"}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modal: {
    backgroundColor: "#fff",
    borderRadius: 20,
    width: "100%",
    maxWidth: 500,
    maxHeight: "90%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  scrollContent: {
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333333",
    marginBottom: 20,
    textAlign: "center",
  },
  coordinatesContainer: {
    backgroundColor: "#F5F5F5",
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  coordinatesLabel: {
    fontSize: 12,
    color: "#999999",
    marginBottom: 4,
  },
  coordinatesText: {
    fontSize: 14,
    color: "#333333",
    fontWeight: "600",
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333333",
    marginBottom: 4,
  },
  helperText: {
    fontSize: 12,
    color: "#666666",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#333333",
    backgroundColor: "#fff",
  },
  textArea: {
    height: 100,
  },
  imageContainer: {
    alignItems: "center",
  },
  image: {
    width: "100%",
    height: 200,
    borderRadius: 8,
    marginBottom: 10,
  },
  changeImageButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  changeImageText: {
    color: "#3e5abcff",
    fontSize: 14,
    fontWeight: "600",
  },
  imagePickerButtons: {
    gap: 10,
  },
  imageButton: {
    backgroundColor: "#F5F5F5",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  imageButtonText: {
    fontSize: 16,
    color: "#333333",
    fontWeight: "600",
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 12,
    marginTop: 10,
  },
  button: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  cancelButtonText: {
    color: "#333333",
    fontSize: 16,
    fontWeight: "600",
  },
  submitButton: {
    backgroundColor: "#3e5abcff",
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
