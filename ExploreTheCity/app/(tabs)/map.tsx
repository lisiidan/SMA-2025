import ImageQuestFormModal from "@/components/admin/ImageQuestFormModal";
import QuestFormModal from "@/components/admin/QuestFormModal";
import QuestDetailsModal from "@/components/quest/QuestDetailsModal";
import { haversineDistance } from "@/domain/geo/distance";
import type { LatLng } from "@/domain/geo/grid";
import { latLngToCell } from "@/domain/geo/grid";
import type { ImageQuest } from "@/models/ImageQuest";
import type { QuestLocation } from "@/models/QuestLocation";
import { useAuth } from "@/utils/firebase/AuthContext";
import {
  createImageQuest,
  deactivateImageQuest,
  getAllImageQuests,
  getQuestsWithStatus,
  submitQuestImage,
  updateImageQuest,
} from "@/utils/firebase/imageQuest";
import {
  createQuestLocation,
  deactivateQuestLocation,
  getActiveQuestLocations,
  updateQuestLocation,
} from "@/utils/firebase/quests";
import { useTracking } from "@/utils/tracking/TrackingContext";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Circle, Marker } from "react-native-maps";

type QuestType = "event" | "image";

export default function MapScreen() {
  // Obține utilizatorul autentificat din AuthContext și funcția pentru procesarea imaginii
  const { user, isProcessingImage, setIsProcessingImage } = useAuth();

  // Get tracking state and functions from TrackingContext
  const { trackingState, visitedCellsLocations, onLocationUpdate } = useTracking();

  console.log("🚀 [MapScreen] Component rendered/re-rendered");
  console.log(
    "👤 [MapScreen] Current user:",
    user ? { uid: user.uid, email: user.email } : "null"
  );

  // Initial coordinates for Timișoara city center
  const [region, setRegion] = useState({
    latitude: 45.7537,
    longitude: 21.2257,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });

  // State pentru locația curentă
  const [currentLocation, setCurrentLocation] = useState<LatLng | null>(null);

  // State pentru rezultatele procesării imaginii
  const [showResultModal, setShowResultModal] = useState(false);
  const [resultMessage, setResultMessage] = useState("");

  // State pentru quest-uri (image quests)
  const [quests, setQuests] = useState<
    Array<ImageQuest & { isSolved: boolean }>
  >([]);
  const [selectedQuest, setSelectedQuest] = useState<ImageQuest | null>(null);
  const [showQuestDialog, setShowQuestDialog] = useState(false);

  // Admin state
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminQuestType, setAdminQuestType] = useState<QuestType>("event");
  const [isEditMode, setIsEditMode] = useState(false);
  const [showQuestModal, setShowQuestModal] = useState(false);
  const [showImageQuestModal, setShowImageQuestModal] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [questLocations, setQuestLocations] = useState<QuestLocation[]>([]);
  const [adminImageQuests, setAdminImageQuests] = useState<ImageQuest[]>([]); // Admin view of image quests

  // Quest details modal state (for all users)
  const [showQuestDetails, setShowQuestDetails] = useState(false);
  const [selectedQuestLocation, setSelectedQuestLocation] =
    useState<QuestLocation | null>(null);

  // Edit quest state (admin only)
  const [isEditingQuest, setIsEditingQuest] = useState(false);
  const [questToEdit, setQuestToEdit] = useState<QuestLocation | null>(null);
  const [isEditingImageQuest, setIsEditingImageQuest] = useState(false);
  const [imageQuestToEdit, setImageQuestToEdit] = useState<ImageQuest | null>(null);

  // Track which quest locations have been manually dismissed by the user
  const [dismissedQuestLocations, setDismissedQuestLocations] = useState<
    Set<string>
  >(new Set());

  // Track which quest locations have been activated (entered radius at least once)
  const [activatedQuestLocations, setActivatedQuestLocations] = useState<
    Set<string>
  >(new Set());

  // Memoize quest radius checks pentru a preveni flickering-ul
  // Aceasta se recalculează doar când se schimbă currentLocation sau quests
  const questsInRadius = useMemo(() => {
    if (!currentLocation) return new Set<string>();

    const questsInRange = new Set<string>();
    quests.forEach((quest) => {
      const questLocation: LatLng = {
        lat: quest.latitude,
        lng: quest.longitude,
      };
      const distance = haversineDistance(currentLocation, questLocation);
      if (distance <= quest.questRadius) {
        questsInRange.add(quest.questId);
      }
    });

    return questsInRange;
  }, [currentLocation, quests]);

  // Memoize quest location radius checks (for golden pins)
  const questLocationsInRadius = useMemo(() => {
    if (!currentLocation) return new Set<string>();

    const inRange = new Set<string>();
    questLocations.forEach((quest) => {
      const questLocation: LatLng = {
        lat: quest.latitude,
        lng: quest.longitude,
      };
      const distance = haversineDistance(currentLocation, questLocation);
      if (distance <= quest.questRadius) {
        inRange.add(quest.id);
      }
    });

    return inRange;
  }, [currentLocation, questLocations]);

  // Check if user is admin
  useEffect(() => {
    const checkAdminStatus = async () => {
      const adminStatus = await AsyncStorage.getItem("isAdmin");
      setIsAdmin(adminStatus === "true");
    };
    checkAdminStatus();
  }, []);

  // Load quest locations
  useEffect(() => {
    const loadQuestLocations = async () => {
      const quests = await getActiveQuestLocations();
      setQuestLocations(quests);
    };
    loadQuestLocations();
  }, []);

  // Load admin image quests (for admin view only)
  useEffect(() => {
    const loadAdminImageQuests = async () => {
      if (!isAdmin) return;
      const quests = await getAllImageQuests();
      setAdminImageQuests(quests);
    };
    loadAdminImageQuests();
  }, [isAdmin]);

  // Auto-open quest location details when user enters radius
  useEffect(() => {
    if (!currentLocation || questLocations.length === 0) return;

    // Track quest locations that have entered radius (for persistent orange pins)
    setActivatedQuestLocations((prev) => {
      const newSet = new Set(prev);
      let hasChanges = false;

      questLocationsInRadius.forEach((questId) => {
        if (!prev.has(questId)) {
          newSet.add(questId);
          hasChanges = true;
        }
      });

      return hasChanges ? newSet : prev;
    });

    // Clean up dismissed quest locations - remove any that are no longer in radius
    // This allows quest to auto-open again if user leaves and returns
    setDismissedQuestLocations((prev) => {
      const newSet = new Set(prev);
      let hasChanges = false;

      prev.forEach((questId) => {
        if (!questLocationsInRadius.has(questId)) {
          newSet.delete(questId);
          hasChanges = true;
        }
      });

      return hasChanges ? newSet : prev;
    });

    // Find the first quest location in radius that hasn't been dismissed
    const questInRange = questLocations.find(
      (quest) =>
        questLocationsInRadius.has(quest.id) &&
        !dismissedQuestLocations.has(quest.id)
    );

    // Auto-open details if user entered radius and modal is not already open
    if (questInRange && !showQuestDetails && !isAdmin) {
      console.log("User entered radius of quest location:", questInRange.id);
      setSelectedQuestLocation(questInRange);
      setShowQuestDetails(true);
    }
  }, [
    questLocationsInRadius,
    questLocations,
    currentLocation,
    showQuestDetails,
    isAdmin,
    dismissedQuestLocations,
  ]);

  // Get user's current location + urmărim mișcarea
  useEffect(() => {
    console.log("📍 [useEffect:Location] Starting location tracking setup...");
    let subscription: any = null;

    (async () => {
      // Request location permission
      console.log("🔐 [useEffect:Location] Requesting location permission...");
      let { status } = await Location.requestForegroundPermissionsAsync();
      console.log("✅ [useEffect:Location] Permission status:", status);

      if (status !== "granted") {
        console.log("❌ [useEffect:Location] Location permission denied");
        Alert.alert(
          "Permission denied",
          "Location permission is required to use this feature"
        );
        return;
      }

      // Get current location
      console.log("📍 [useEffect:Location] Getting current position...");
      let location = await Location.getCurrentPositionAsync({});
      const currentLocation: LatLng = {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      };
      console.log(
        "✅ [useEffect:Location] Current location obtained:",
        currentLocation
      );

      // Setează locația curentă
      setCurrentLocation(currentLocation);

      // Update region to user's location
      setRegion({
        latitude: currentLocation.lat,
        longitude: currentLocation.lng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
      console.log(
        "🗺️ [useEffect:Location] Map region updated to current location"
      );

      // Începem să urmărim mișcarea user-ului
      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 3000, // la ~3 secunde
          distanceInterval: 5, // sau dacă s-a mișcat > 5m
        },
        (loc) => {
          const newLoc: LatLng = {
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
          };

          // Actualizează locația curentă
          setCurrentLocation(newLoc);

          // Use TrackingContext to handle location update
          onLocationUpdate(newLoc);
        }
      );
    })();

    // cleanup când se închide ecranul
    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, []);

  // Încarcă quest-urile cu statusul lor
  useEffect(() => {
    const loadQuests = async () => {
      if (!user) {
        console.log(
          "⚠️ [loadQuests] No user authenticated, skipping quest loading"
        );
        return; // Nu încărcăm quest-uri dacă utilizatorul nu e autentificat
      }

      try {
        console.log("📥 [loadQuests] Loading quests for user:", user.uid);
        const questsWithStatus = await getQuestsWithStatus(user.uid);
        console.log(
          "✅ [loadQuests] Quests loaded successfully, count:",
          questsWithStatus.length
        );
        console.log(
          "📋 [loadQuests] All quests details:",
          JSON.stringify(questsWithStatus, null, 2)
        );

        // Log fiecare quest individual pentru debugging
        questsWithStatus.forEach((quest, index) => {
          console.log(`🎯 [loadQuests] Quest ${index + 1}:`, {
            questId: quest.questId,
            description: quest.description,
            latitude: quest.latitude,
            longitude: quest.longitude,
            imageUrl: quest.imageUrl,
            score: quest.score,
            questRadius: quest.questRadius,
            isSolved: quest.isSolved,
            createdAt: quest.createdAt,
          });
        });

        setQuests(questsWithStatus);
      } catch (error) {
        console.error("❌ [loadQuests] Error loading quests:", error);
        console.error(
          "❌ [loadQuests] Error stack:",
          error instanceof Error ? error.stack : "No stack trace"
        );
      }
    };

    loadQuests();
  }, [user]);

  // Custom map style - hides POIs, businesses, labels, etc.
  const customMapStyle = [
    {
      featureType: "poi",
      elementType: "labels",
      stylers: [{ visibility: "on" }],
    },
    {
      featureType: "poi.business",
      stylers: [{ visibility: "off" }],
    },
    {
      featureType: "transit",
      elementType: "labels.icon",
      stylers: [{ visibility: "off" }],
    },
    {
      featureType: "transit.station",
      stylers: [{ visibility: "on" }],
    },
  ];

  const handleCameraPress = async () => {
    console.log("📷 [handleCameraPress] Camera button pressed!");
    console.log(
      "👤 [handleCameraPress] Current user:",
      user ? user.uid : "null"
    );
    console.log("📍 [handleCameraPress] Current location:", currentLocation);
    console.log("🎯 [handleCameraPress] Loaded quests count:", quests.length);

    try {
      // Verifică dacă utilizatorul este autentificat
      if (!user) {
        console.log("⚠️ [handleCameraPress] User not authenticated");
        Alert.alert(
          "Autentificare necesară",
          "Trebuie să fii autentificat pentru a completa quest-uri.",
          [{ text: "OK" }]
        );
        return;
      }

      // Verifică dacă locația utilizatorului este disponibilă
      if (!currentLocation) {
        console.log("⚠️ [handleCameraPress] Location not available");
        Alert.alert(
          "Locație necesară",
          "Te rog așteaptă până obținem locația ta curentă.",
          [{ text: "OK" }]
        );
        return;
      }

      console.log(
        "✅ [handleCameraPress] User and location verified, requesting camera permission..."
      );
      const { status } = await ImagePicker.requestCameraPermissionsAsync();

      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Camera permission is required to take photos.",
          [{ text: "OK" }]
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: "images",
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.5, // 50% quality - reduce tokeni consumați în Gemini API
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const photo = result.assets[0];
        console.log("📸 Photo captured:", photo.uri);
        console.log("📍 Current location:", currentLocation);
        console.log("👤 User ID:", user.uid);

        // Afișează indicator de procesare
        setIsProcessingImage(true);
        console.log("⏳ Started processing image...");

        try {
          // Trimite imaginea pentru verificarea quest-ului folosind Gemini AI
          console.log("🚀 Calling submitQuestImage...");
          const submissionResult = await submitQuestImage(
            photo.uri,
            currentLocation,
            user.uid
          );

          console.log("✅ submitQuestImage completed");
          console.log(
            "📊 Submission result:",
            JSON.stringify(submissionResult, null, 2)
          );

          setIsProcessingImage(false);

          if (submissionResult.success && submissionResult.quest) {
            // Succes! Quest completat
            console.log("🎉 Quest completed successfully!");
            console.log("🏆 Quest details:", submissionResult.quest);
            console.log("💰 Points earned:", submissionResult.pointsEarned);

            // Reîncarcă quest-urile pentru a actualiza statusul
            console.log("🔄 Reloading quests...");
            const updatedQuests = await getQuestsWithStatus(user.uid);
            console.log("📋 Updated quests count:", updatedQuests.length);
            setQuests(updatedQuests);

            setResultMessage(
              `🎉 Quest Completat!\n\n` +
                `"${submissionResult.quest.description}"\n\n` +
                `Încredere: ${submissionResult.result.confidence}%\n` +
                `Puncte câștigate: ${submissionResult.pointsEarned}\n\n` +
                `${submissionResult.result.reasoning}`
            );
            setShowResultModal(true);
            console.log("✅ Result modal shown (success)");
          } else {
            // Nu s-a găsit potrivire
            console.log("❌ No quest match found");
            console.log(
              "📝 Result reasoning:",
              submissionResult.result?.reasoning
            );

            setResultMessage(
              `❌ Nu s-a găsit potrivire\n\n` +
                `${submissionResult.result.reasoning}\n\n` +
                `Încearcă să faci o poză unui monument sau locație de quest din apropiere!`
            );
            setShowResultModal(true);
            console.log("✅ Result modal shown (no match)");
          }
        } catch (error) {
          setIsProcessingImage(false);
          console.error("❌ Error processing image:", error);
          console.error("❌ Error details:", JSON.stringify(error, null, 2));
          console.error(
            "❌ Error stack:",
            error instanceof Error ? error.stack : "No stack trace"
          );

          Alert.alert(
            "Eroare",
            "Nu s-a putut procesa imaginea. Te rog verifică conexiunea la internet și încearcă din nou.",
            [{ text: "OK" }]
          );
        }
      } else {
        console.log("📷 Camera canceled or no photo taken");
      }
    } catch (error) {
      setIsProcessingImage(false);
      console.error("Error launching camera:", error);
      Alert.alert(
        "Eroare",
        "Nu s-a putut deschide camera. Te rog încearcă din nou.",
        [{ text: "OK" }]
      );
    }
  };

  const handleToggleEditMode = () => {
    setIsEditMode(!isEditMode);
    Alert.alert(
      isEditMode ? "Edit Mode Disabled" : "Edit Mode Enabled",
      isEditMode
        ? `You can no longer create ${adminQuestType} quest locations.`
        : `Tap anywhere on the map to create a ${adminQuestType} quest location.`
    );
  };

  const handleQuestSubmit = async (questData: {
    latitude: number;
    longitude: number;
    title: string;
    description: string;
    imageUri: string;
  }) => {
    try {
      const adminEmail =
        (await AsyncStorage.getItem("adminEmail")) || "admin@walkwithme.com";
      await createQuestLocation(questData, adminEmail);

      // Reload quest locations
      const quests = await getActiveQuestLocations();
      setQuestLocations(quests);
    } catch (error) {
      console.error("Error creating quest:", error);
      throw error;
    }
  };

  const handleImageQuestSubmit = async (questData: {
    latitude: number;
    longitude: number;
    description: string;
    imageUri: string;
    score: number;
    questRadius: number;
  }) => {
    try {
      const adminEmail =
        (await AsyncStorage.getItem("adminEmail")) || "admin@walkwithme.com";
      // Use adminEmail as orgId for now
      await createImageQuest(questData, adminEmail);

      // Reload image quests
      const quests = await getAllImageQuests();
      setAdminImageQuests(quests);
    } catch (error) {
      console.error("Error creating image quest:", error);
      throw error;
    }
  };

  const handleQuestLocationMarkerPress = (
    quest: QuestLocation,
    inRadius: boolean
  ) => {
    try {
      console.log("Quest location marker pressed:", quest);

      // If admin, show action sheet with edit/delete options
      if (isAdmin) {
        Alert.alert(
          "Quest Options",
          "What would you like to do with this quest?",
          [
            {
              text: "View Details",
              onPress: () => {
                setSelectedQuestLocation(quest);
                setShowQuestDetails(true);
              },
            },
            {
              text: "Edit Quest",
              onPress: () => {
                setQuestToEdit(quest);
                setIsEditingQuest(true);
                setShowQuestModal(true);
              },
            },
            {
              text: "Delete Quest",
              style: "destructive",
              onPress: () => handleDeleteQuest(quest.id),
            },
            {
              text: "Cancel",
              style: "cancel",
            },
          ]
        );
      } else {
        // Normal users can only interact if they're in radius
        if (!inRadius) {
          Alert.alert(
            "Too Far Away",
            "You’re almost there! Get closer to this location to reveal its secrets.",
            [{ text: "OK" }]
          );
          return;
        }

        // User is in radius - show details
        setSelectedQuestLocation(quest);
        setShowQuestDetails(true);
      }
    } catch (error) {
      console.error("Error opening quest options:", error);
      Alert.alert("Error", "Could not open quest options. Please try again.");
    }
  };

  const handleDeleteQuest = async (questId: string) => {
    Alert.alert(
      "Delete Event Quest",
      "Are you sure you want to delete this quest location? This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deactivateQuestLocation(questId);
              Alert.alert("Success", "Quest location deleted successfully!");

              // Reload quest locations
              const quests = await getActiveQuestLocations();
              setQuestLocations(quests);
            } catch (error) {
              console.error("Error deleting quest:", error);
              Alert.alert(
                "Error",
                "Failed to delete quest location. Please try again."
              );
            }
          },
        },
      ]
    );
  };

  const handleDeleteImageQuest = async (questId: string) => {
    Alert.alert(
      "Delete Image Quest",
      "Are you sure you want to delete this image quest? This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deactivateImageQuest(questId);
              Alert.alert("Success", "Image quest deleted successfully!");

              // Reload image quests
              const quests = await getAllImageQuests();
              setAdminImageQuests(quests);
            } catch (error) {
              console.error("Error deleting image quest:", error);
              Alert.alert(
                "Error",
                "Failed to delete image quest. Please try again."
              );
            }
          },
        },
      ]
    );
  };

  const handleImageQuestMarkerPress = (quest: ImageQuest) => {
    try {
      console.log("Image quest marker pressed:", quest);

      // If admin, show action sheet with edit/delete options
      if (isAdmin) {
        Alert.alert(
          "Image Quest Options",
          "What would you like to do with this quest?",
          [
            {
              text: "View Details",
              onPress: () => {
                Alert.alert(
                  "Image Quest Details",
                  `Description: ${quest.description}\n\nScore: ${quest.score} points\n\nRadius: ${quest.questRadius}m`,
                  [{ text: "OK" }]
                );
              },
            },
            {
              text: "Edit Quest",
              onPress: () => {
                setImageQuestToEdit(quest);
                setIsEditingImageQuest(true);
                setSelectedLocation({ lat: quest.latitude, lng: quest.longitude });
                setShowImageQuestModal(true);
              },
            },
            {
              text: "Delete Quest",
              style: "destructive",
              onPress: () => handleDeleteImageQuest(quest.questId),
            },
            {
              text: "Cancel",
              style: "cancel",
            },
          ]
        );
      } else {
        // For regular users, show helpful message about the photo quest
        Alert.alert(
          "📸 Photo Quest",
          `${quest.description}\n\nTake a photo of this location or object to earn ${quest.score} points!\n\nUse the camera button at the bottom of the screen when you're nearby.`,
          [{ text: "Got it!" }]
        );
      }
    } catch (error) {
      console.error("Error opening image quest options:", error);
      Alert.alert("Error", "Could not open quest options. Please try again.");
    }
  };

  const handleQuestUpdate = async (questData: {
    latitude: number;
    longitude: number;
    title: string;
    description: string;
    imageUri: string;
  }) => {
    if (!questToEdit) return;

    try {
      const updateData: any = {
        title: questData.title,
        description: questData.description,
      };

      // Only include imageUri if it's different from the existing one (new upload)
      if (questData.imageUri !== questToEdit.imageUrl) {
        updateData.imageUri = questData.imageUri;
      }

      await updateQuestLocation(questToEdit.id, updateData);

      // Reload quest locations
      const quests = await getActiveQuestLocations();
      setQuestLocations(quests);

      // Reset edit state
      setIsEditingQuest(false);
      setQuestToEdit(null);
    } catch (error) {
      console.error("Error updating quest:", error);
      throw error;
    }
  };

  const handleImageQuestUpdate = async (questData: {
    latitude: number;
    longitude: number;
    description: string;
    imageUri: string;
    score: number;
    questRadius: number;
  }) => {
    if (!imageQuestToEdit) return;

    try {
      const updateData: any = {
        description: questData.description,
        score: questData.score,
        questRadius: questData.questRadius,
      };

      // Only include imageUri if it's different from the existing one (new upload)
      if (questData.imageUri !== imageQuestToEdit.imageUrl) {
        updateData.imageUri = questData.imageUri;
      }

      await updateImageQuest(imageQuestToEdit.questId, updateData);

      // Reload image quests
      const quests = await getAllImageQuests();
      setAdminImageQuests(quests);

      // Reset edit state
      setIsEditingImageQuest(false);
      setImageQuestToEdit(null);
    } catch (error) {
      console.error("Error updating image quest:", error);
      throw error;
    }
  };

  const handleMapPress = (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;

    // If admin is in edit mode, allow selecting location for quest
    if (isAdmin && isEditMode) {
      setSelectedLocation({ lat: latitude, lng: longitude });
      if (adminQuestType === "event") {
        setShowQuestModal(true);
      } else {
        setShowImageQuestModal(true);
      }
      return;
    }

    const loc: LatLng = { lat: latitude, lng: longitude };
    const cellId = latLngToCell(loc);

    console.log("Clicked cell:", cellId);

    onLocationUpdate(loc);
    // ========================== DECOMMENT FOR DEBUG PURPOSES ==========================

    // // 1) actualizăm trackingState (pentru logică)
    // setTrackingState((prev) => {
    //   const newState: TrackingState = {
    //     ...prev,
    //     visitedCells: new Set(prev.visitedCells),
    //   };
    //   newState.visitedCells.add(cellId);
    //   return newState;
    // });

    // // 2) punem cerc exact la locul apăsat (debug frumos)
    // setVisitedCellsLocations((prev) => [...prev, loc]);

    // ========================== DECOMMENT FOR DEBUG PURPOSES ==========================
  };

  const handleProfilePress = () => {
    // console.log("Profile button pressed");
    try {
      router.push("/profile");
      // console.log("Navigation to profile triggered");
    } catch (error) {
      // console.error("Error navigating to profile:", error);
      Alert.alert("Navigation Error", "Could not navigate to profile");
    }
  };

  const handleLeaderboardPress = () => {
    // console.log("Leaderboard button pressed");
    try {
      router.push("/leaderboard");
      // console.log("Navigation to leaderboard triggered");
    } catch (error) {
      // console.error("Error navigating to leaderboard:", error);
      Alert.alert("Navigation Error", "Could not navigate to leaderboard");
    }
  };

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        region={region}
        customMapStyle={customMapStyle}
        showsUserLocation={true}
        showsMyLocationButton={false}
        showsCompass={false}
        showsScale={false}
        showsBuildings={false}
        showsTraffic={false}
        showsIndoors={false}
        toolbarEnabled={false}
        onPress={handleMapPress}
        onPanDrag={() => setShowQuestDialog(false)} // Ascunde dialogul când se mișcă harta

        pointerEvents="auto"
      >
        {
  visitedCellsLocations.map((cell, index) => (
    <React.Fragment key={`${cell.lat}-${cell.lng}-${index}`}>
      {/* strat exterior – foarte difuz */}
      <Circle
        center={{ latitude: cell.lat, longitude: cell.lng }}
        radius={45} // metri
        strokeWidth={0}
        fillColor="rgba(0, 200, 83, 0.15)"
      />
      {/* strat mijlociu */}
      <Circle
        center={{ latitude: cell.lat, longitude: cell.lng }}
        radius={30}
        strokeWidth={0}
        fillColor="rgba(0, 200, 83, 0.25)"
      />
      {/* strat interior – mai intens */}
      <Circle
        center={{ latitude: cell.lat, longitude: cell.lng }}
        radius={18}
        strokeWidth={0}
        fillColor="rgba(0, 200, 83, 0.35)"
      />
    </React.Fragment>
  ))}

        {/* Quest Markers și Radius Circles */}
        {quests.map((quest) => {
          const userInRadius = questsInRadius.has(quest.questId);

          return (
            <React.Fragment key={quest.questId}>
              {/* Cerc pentru raza quest-ului - afișat doar când user-ul este în rază și quest-ul NU este rezolvat */}
              {userInRadius && !quest.isSolved && (
                <Circle
                  center={{
                    latitude: quest.latitude,
                    longitude: quest.longitude,
                  }}
                  radius={quest.questRadius}
                  strokeWidth={2}
                  strokeColor="rgba(255, 165, 0, 0.5)"
                  fillColor="rgba(255, 165, 0, 0.1)"
                />
              )}

              {/* Marker pentru quest - PIN cu question mark sau checkmark */}
              <Marker
                coordinate={{
                  latitude: quest.latitude,
                  longitude: quest.longitude,
                }}
                onPress={() => {
                  if (quest.isSolved) {
                    setSelectedQuest(quest);
                    setShowQuestDialog(true);
                  } else {
                    // Show helpful message for unsolved image quests
                    Alert.alert(
                      "Photo Quest",
                      `\nFolosește camera foto pentru a lua o poză cu un obiect turistic în raza de ${quest.questRadius}, sau un alt element pentru a primi puncte bonus!`,
                      [{ text: "Am înțeles!" }]
                    );
                  }
                }}
              >
                <View
                  style={[
                    styles.questMarker,
                    {
                      backgroundColor: quest.isSolved ? "#00C853" : "#FF9800",
                    },
                  ]}
                >
                  {quest.isSolved ? (
                    <Ionicons name="checkmark" size={28} color="#FFFFFF" />
                  ) : (
                    <Ionicons name="help" size={28} color="#FFFFFF" />
                  )}
                </View>
              </Marker>
            </React.Fragment>
          );
        })}

        {/* Quest Location Markers - Golden Question Mark/Alert Pins */}
        {questLocations.map((quest) => {
          const inRadius = questLocationsInRadius.has(quest.id);
          const isActivated = activatedQuestLocations.has(quest.id);

          return (
            <React.Fragment key={quest.id}>
              {/* Marker - changes icon when user enters radius */}
              <Marker
                coordinate={{
                  latitude: quest.latitude,
                  longitude: quest.longitude,
                }}
                onPress={() => handleQuestLocationMarkerPress(quest, inRadius)}
              >
                <View
                  style={[
                    styles.questMarker,
                    isActivated && styles.questMarkerActive,
                  ]}
                >
                  <Ionicons
                    name={isActivated ? "alert" : "help"}
                    size={28}
                    color="#FFFFFF"
                  />
                </View>
              </Marker>
            </React.Fragment>
          );
        })}

        {/* Image Quest Markers - Orange Question Marks (visible for admins, for editing) */}
        {isAdmin && adminImageQuests.map((quest) => {
          return (
            <React.Fragment key={quest.questId}>
              {/* Radius circle for image quest (only visible in admin mode) */}
              <Circle
                center={{
                  latitude: quest.latitude,
                  longitude: quest.longitude,
                }}
                radius={quest.questRadius}
                strokeWidth={2}
                strokeColor="rgba(255, 165, 0, 0.5)"
                fillColor="rgba(255, 165, 0, 0.1)"
              />
              {/* Marker - Orange question mark like photo quests */}
              <Marker
                coordinate={{
                  latitude: quest.latitude,
                  longitude: quest.longitude,
                }}
                onPress={() => handleImageQuestMarkerPress(quest)}
              >
                <View
                  style={[
                    styles.questMarker,
                    { backgroundColor: "#FF9800" }, // Orange color
                  ]}
                >
                  <Ionicons name="help" size={28} color="#FFFFFF" />
                </View>
              </Marker>
            </React.Fragment>
          );
        })}
      </MapView>

      {/* Top Left - Leaderboard Button */}
      <TouchableOpacity
        style={[styles.topButton, styles.topLeftButton]}
        onPress={handleLeaderboardPress}
        activeOpacity={0.8}
        accessible={true}
        accessibilityLabel="Leaderboard"
      >
        <Ionicons name="trophy" size={24} color="#3e5abcff" />
      </TouchableOpacity>

      {/* Top Right - My Account Button */}
      <TouchableOpacity
        style={[styles.topButton, styles.topRightButton]}
        onPress={handleProfilePress}
        activeOpacity={0.8}
        accessible={true}
        accessibilityLabel="Profile"
      >
        <Ionicons name="person" size={24} color="#3e5abcff" />
      </TouchableOpacity>

      {/* Bottom Center - Camera Button */}
      <TouchableOpacity
        style={styles.cameraButton}
        onPress={handleCameraPress}
        activeOpacity={0.8}
        accessible={true}
        accessibilityLabel="Camera"
        disabled={isProcessingImage}
      >
        {isProcessingImage ? (
          <ActivityIndicator size="large" color="#FFFFFF" />
        ) : (
          <Ionicons name="camera" size={55} color="#FFFFFF" />
        )}
      </TouchableOpacity>

      {/* Admin Edit Mode Button - Bottom Right */}
      {isAdmin && (
        <>
          {/* Quest Type Selector */}
          {isEditMode && (
            <View style={styles.questTypeSelector}>
              <TouchableOpacity
                style={[
                  styles.questTypeButton,
                  adminQuestType === "event" && styles.questTypeButtonActive,
                ]}
                onPress={() => setAdminQuestType("event")}
              >
                <Ionicons
                  name="location"
                  size={20}
                  color={adminQuestType === "event" ? "#FFFFFF" : "#3e5abcff"}
                />
                <Text
                  style={[
                    styles.questTypeButtonText,
                    adminQuestType === "event" && styles.questTypeButtonTextActive,
                  ]}
                >
                  Event
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.questTypeButton,
                  adminQuestType === "image" && styles.questTypeButtonActive,
                ]}
                onPress={() => setAdminQuestType("image")}
              >
                <Ionicons
                  name="camera"
                  size={20}
                  color={adminQuestType === "image" ? "#FFFFFF" : "#3e5abcff"}
                />
                <Text
                  style={[
                    styles.questTypeButtonText,
                    adminQuestType === "image" && styles.questTypeButtonTextActive,
                  ]}
                >
                  Image
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.editModeButton,
              isEditMode && styles.editModeButtonActive,
            ]}
            onPress={handleToggleEditMode}
            activeOpacity={0.8}
            accessible={true}
            accessibilityLabel="Toggle Edit Mode"
          >
            <Ionicons
              name={isEditMode ? "create" : "create-outline"}
              size={24}
              color={isEditMode ? "#FFFFFF" : "#3e5abcff"}
            />
          </TouchableOpacity>
        </>
      )}

      {/* Quest Form Modal - Create or Edit */}
      <QuestFormModal
        visible={showQuestModal}
        latitude={
          isEditingQuest && questToEdit
            ? questToEdit.latitude
            : selectedLocation?.lat || 0
        }
        longitude={
          isEditingQuest && questToEdit
            ? questToEdit.longitude
            : selectedLocation?.lng || 0
        }
        onClose={() => {
          setShowQuestModal(false);
          setSelectedLocation(null);
          setIsEditingQuest(false);
          setQuestToEdit(null);
        }}
        onSubmit={isEditingQuest ? handleQuestUpdate : handleQuestSubmit}
        editMode={isEditingQuest}
        existingQuest={
          questToEdit
            ? {
                id: questToEdit.id,
                title: questToEdit.title,
                description: questToEdit.description,
                imageUrl: questToEdit.imageUrl,
              }
            : null
        }
      />

      {/* Image Quest Form Modal - Create or Edit */}
      <ImageQuestFormModal
        visible={showImageQuestModal}
        latitude={
          isEditingImageQuest && imageQuestToEdit
            ? imageQuestToEdit.latitude
            : selectedLocation?.lat || 0
        }
        longitude={
          isEditingImageQuest && imageQuestToEdit
            ? imageQuestToEdit.longitude
            : selectedLocation?.lng || 0
        }
        onClose={() => {
          setShowImageQuestModal(false);
          setSelectedLocation(null);
          setIsEditingImageQuest(false);
          setImageQuestToEdit(null);
        }}
        onSubmit={isEditingImageQuest ? handleImageQuestUpdate : handleImageQuestSubmit}
        editMode={isEditingImageQuest}
        existingQuest={
          imageQuestToEdit
            ? {
                id: imageQuestToEdit.questId,
                description: imageQuestToEdit.description,
                imageUrl: imageQuestToEdit.imageUrl || "",
                score: imageQuestToEdit.score,
                questRadius: imageQuestToEdit.questRadius,
              }
            : null
        }
      />

      {/* Quest Details Modal - All Users */}
      <QuestDetailsModal
        visible={showQuestDetails}
        quest={selectedQuestLocation}
        isActivated={
          selectedQuestLocation
            ? activatedQuestLocations.has(selectedQuestLocation.id)
            : false
        }
        onClose={() => {
          // Mark this quest as dismissed so it won't auto-open again
          if (selectedQuestLocation && !isAdmin) {
            setDismissedQuestLocations((prev) => {
              const newSet = new Set(prev);
              newSet.add(selectedQuestLocation.id);
              return newSet;
            });
          }
          setShowQuestDetails(false);
          setSelectedQuestLocation(null);
        }}
      />

      {/* Quest Dialog - afișat deasupra marker-ului când quest-ul este solved */}
      {showQuestDialog && selectedQuest && (
        <View style={styles.questDialogContainer}>
          <View style={styles.questDialog}>
            <Text style={styles.questDialogTitle}>✅ Quest Completat!</Text>
            <Text style={styles.questDialogDescription}>
              {selectedQuest.description}
            </Text>
            <Text style={styles.questDialogScore}>
              Puncte: {selectedQuest.score}
            </Text>
            <TouchableOpacity
              style={styles.questDialogButton}
              onPress={() => setShowQuestDialog(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.questDialogButtonText}>Închide</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Result Modal */}
      <Modal
        visible={showResultModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowResultModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalText}>{resultMessage}</Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setShowResultModal(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.modalButtonText}>Închide</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  topButton: {
    position: "absolute",
    top: Platform.OS === "ios" ? 60 : 40,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 10,
  },
  topLeftButton: {
    left: 20,
  },
  topRightButton: {
    right: 20,
  },
  cameraButton: {
    position: "absolute",
    bottom: 50,
    alignSelf: "center",
    left: "50%",
    marginLeft: -38.5,
    width: 77,
    height: 77,
    borderRadius: 38.5,
    backgroundColor: "#3e5abcff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 20,
    maxWidth: 400,
    width: "90%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalText: {
    fontSize: 16,
    lineHeight: 24,
    color: "#064E3B",
    marginBottom: 20,
    textAlign: "center",
  },
  modalButton: {
    backgroundColor: "#3e5abcff",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: "center",
  },
  modalButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  markerContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  pinContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  pinTip: {
    width: 0,
    height: 0,
    backgroundColor: "transparent",
    borderStyle: "solid",
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 12,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    marginTop: -2,
  },
  questDialogContainer: {
    position: "absolute",
    top: Platform.OS === "ios" ? 120 : 100,
    left: 20,
    right: 20,
    alignItems: "center",
    zIndex: 20,
  },
  questDialog: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    maxWidth: 350,
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 2,
    borderColor: "#00C853",
  },
  questDialogTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#00C853",
    marginBottom: 12,
    textAlign: "center",
  },
  questDialogDescription: {
    fontSize: 16,
    lineHeight: 22,
    color: "#064E3B",
    marginBottom: 12,
    textAlign: "center",
  },
  questDialogScore: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3e5abcff",
    marginBottom: 16,
    textAlign: "center",
  },
  questDialogButton: {
    backgroundColor: "#00C853",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: "center",
  },
  questDialogButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  editModeButton: {
    position: "absolute",
    bottom: 50,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 10,
  },
  editModeButtonActive: {
    backgroundColor: "#FFD700", // Golden color when active
  },
  questMarker: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFD700", // Golden color
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  questMarkerActive: {
    backgroundColor: "#FFA500", // Orange color when in radius
  },
  imageQuestMarker: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#9C27B0", // Purple color for image quests
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  questTypeSelector: {
    position: "absolute",
    bottom: 120,
    right: 20,
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 10,
  },
  questTypeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 24,
    backgroundColor: "transparent",
  },
  questTypeButtonActive: {
    backgroundColor: "#3e5abcff",
  },
  questTypeButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#3e5abcff",
  },
  questTypeButtonTextActive: {
    color: "#FFFFFF",
  },
});