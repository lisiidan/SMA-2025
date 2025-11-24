import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";

interface QuestFormModalProps {
  visible: boolean;
  latitude: number;
  longitude: number;
  onClose: () => void;
  onSubmit: (data: {
    latitude: number;
    longitude: number;
    title: string;
    description: string;
    imageUri: string;
  }) => Promise<void>;
  editMode?: boolean;
  existingQuest?: {
    id: string;
    title: string;
    description: string;
    imageUrl: string;
  } | null;
}

export default function QuestFormModal({
  visible,
  latitude,
  longitude,
  onClose,
  onSubmit,
  editMode = false,
  existingQuest = null,
}: QuestFormModalProps) {
  const [description, setDescription] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize with existing quest data if in edit mode
  React.useEffect(() => {
    if (editMode && existingQuest) {
      setDescription(existingQuest.description);
      setImageUri(existingQuest.imageUrl);
    } else {
      setDescription("");
      setImageUri(null);
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

    setIsSubmitting(true);

    try {
      // Auto-generate title from first 50 characters of description
      const title = description.trim().substring(0, 50);

      console.log("Submitting quest:", { latitude, longitude, title, description, imageUri });

      await onSubmit({
        latitude,
        longitude,
        title,
        description: description.trim(),
        imageUri,
      });

      // Reset form
      setDescription("");
      setImageUri(null);
      onClose();

      Alert.alert("Success", "Quest location created successfully!");
    } catch (error: any) {
      console.error("Quest creation error:", error);
      const errorMessage = error?.message || "Failed to create quest location. Please try again.";
      Alert.alert("Error", errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setDescription("");
      setImageUri(null);
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
                {editMode ? "Edit Quest Location" : "Create Quest Location"}
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
                <Text style={styles.label}>Quest Image *</Text>
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
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Enter quest description..."
                  placeholderTextColor="#999999"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  maxLength={300}
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
