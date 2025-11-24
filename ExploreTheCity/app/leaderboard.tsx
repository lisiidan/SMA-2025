import { getTopClients } from "@/utils/firebase/auth";
import { useAuth } from "@/utils/firebase/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface LeaderboardUser {
  clientId: string;
  rank: number;
  name: string;
  score: number;
}

export default function LeaderboardScreen() {
  const { user } = useAuth();
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      try {
        const topClients = await getTopClients(10);
        const formattedData: LeaderboardUser[] = topClients.map((client, index) => ({
          clientId: client.clientId,
          rank: index + 1,
          name: client.name,
          score: client.accumulatedScore,
        }));
        setLeaderboardData(formattedData);
      } catch (error) {
        console.error('Error fetching leaderboard:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return "#FFD700"; // Gold
      case 2:
        return "#C0C0C0"; // Silver
      case 3:
        return "#CD7F32"; // Bronze
      default:
        return "#3e5abcff"; // Default blue
    }
  };

  const getRankIcon = (rank: number) => {
    if (rank <= 3) {
      return "trophy";
    }
    return "ribbon";
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color="#3e5abcff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Leaderboard</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3e5abcff" />
          <Text style={styles.loadingText}>Loading leaderboard...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#3e5abcff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Leaderboard</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Top 3 Podium */}
      {leaderboardData.length >= 3 && (
        <View style={styles.podiumContainer}>
          {/* 2nd Place */}
          <View style={styles.podiumItem}>
            <View style={[styles.podiumRank, { backgroundColor: "#C0C0C0" }]}>
              <Ionicons name="trophy" size={24} color="#FFFFFF" />
            </View>
            <View style={[styles.podiumBar, styles.secondPlace]}>
              <Text style={styles.podiumName}>
                {leaderboardData[1]?.name.split(" ")[0]}
              </Text>
              <Text style={styles.podiumPoints}>
                {leaderboardData[1]?.score} pts
              </Text>
            </View>
            <Text style={styles.podiumLabel}>2nd</Text>
          </View>

          {/* 1st Place */}
          <View style={styles.podiumItem}>
            <View style={[styles.podiumRank, { backgroundColor: "#FFD700" }]}>
              <Ionicons name="trophy" size={28} color="#FFFFFF" />
            </View>
            <View style={[styles.podiumBar, styles.firstPlace]}>
              <Text style={styles.podiumName}>
                {leaderboardData[0]?.name.split(" ")[0]}
              </Text>
              <Text style={styles.podiumPoints}>
                {leaderboardData[0]?.score} pts
              </Text>
            </View>
            <Text style={styles.podiumLabel}>1st</Text>
          </View>

          {/* 3rd Place */}
          <View style={styles.podiumItem}>
            <View style={[styles.podiumRank, { backgroundColor: "#CD7F32" }]}>
              <Ionicons name="trophy" size={20} color="#FFFFFF" />
            </View>
            <View style={[styles.podiumBar, styles.thirdPlace]}>
              <Text style={styles.podiumName}>
                {leaderboardData[2]?.name.split(" ")[0]}
              </Text>
              <Text style={styles.podiumPoints}>
                {leaderboardData[2]?.score} pts
              </Text>
            </View>
            <Text style={styles.podiumLabel}>3rd</Text>
          </View>
        </View>
      )}

      {/* Leaderboard List */}
      <ScrollView
        style={styles.listContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.listHeader}>
          <Text style={styles.listHeaderText}>Top 10 Rankings</Text>
        </View>

        {leaderboardData.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="trophy-outline" size={64} color="#94A3B8" />
            <Text style={styles.emptyText}>No players yet</Text>
            <Text style={styles.emptySubtext}>Be the first to score!</Text>
          </View>
        ) : (
          leaderboardData.map((userData) => (
            <View
              key={userData.clientId}
              style={[
                styles.listItem,
                userData.clientId === user?.uid && styles.currentUserItem,
              ]}
            >
              <View style={styles.rankBadge}>
                <Ionicons
                  name={getRankIcon(userData.rank)}
                  size={20}
                  color={getRankColor(userData.rank)}
                />
                <Text
                  style={[styles.rankText, { color: getRankColor(userData.rank) }]}
                >
                  {userData.rank}
                </Text>
              </View>

              <View style={styles.userInfo}>
                <Text
                  style={[
                    styles.userName,
                    userData.clientId === user?.uid && styles.currentUserName,
                  ]}
                >
                  {userData.name}
                  {userData.clientId === user?.uid && " (You)"}
                </Text>
              </View>

              <View style={styles.scoreBadge}>
                <Text style={styles.scoreText}>{userData.score}</Text>
                <Text style={styles.scoreLabel}>pts</Text>
              </View>
            </View>
          ))
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingBottom: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#3e5abcff",
  },
  headerSpacer: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: "#64748B",
    marginTop: 12,
  },
  podiumContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 24,
    backgroundColor: "#FFFFFF",
    gap: 12,
  },
  podiumItem: {
    flex: 1,
    alignItems: "center",
  },
  podiumRank: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  podiumBar: {
    width: "100%",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  firstPlace: {
    height: 120,
    backgroundColor: "#E0E7FF",
  },
  secondPlace: {
    height: 100,
    backgroundColor: "#E0E7FF",
  },
  thirdPlace: {
    height: 80,
    backgroundColor: "#E0E7FF",
  },
  podiumName: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#3e5abcff",
    marginBottom: 4,
  },
  podiumPoints: {
    fontSize: 12,
    color: "#3e5abcff",
    fontWeight: "600",
  },
  podiumLabel: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 8,
    fontWeight: "600",
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  listHeader: {
    paddingVertical: 16,
  },
  listHeaderText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#3e5abcff",
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  currentUserItem: {
    backgroundColor: "#E0E7FF",
    borderWidth: 2,
    borderColor: "#3e5abcff",
  },
  rankBadge: {
    width: 50,
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
  },
  rankText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#3e5abcff",
  },
  currentUserName: {
    color: "#3e5abcff",
    fontWeight: "bold",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#64748B",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#94A3B8",
  },
  scoreBadge: {
    alignItems: "flex-end",
  },
  scoreText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#3e5abcff",
  },
  scoreLabel: {
    fontSize: 10,
    color: "#64748B",
  },
  bottomSpacer: {
    height: 40,
  },
});
