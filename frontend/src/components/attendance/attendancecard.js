import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../styles/colors';

export default function AttendanceCard({ percentage, attended, total, remainingLeaves }) {
  const getColor = () => {
    if (percentage >= 75) return colors.primary;
    if (percentage >= 60) return colors.warning;
    return colors.danger;
  };

  const getMessage = () => {
    if (percentage >= 75) return '✅ Safe Zone';
    if (percentage >= 60) return '⚠️ Below 75%';
    return '🔴 Critical - Take action!';
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Attendance Overview</Text>
      
      <View style={styles.percentageContainer}>
        <Text style={[styles.percentage, { color: getColor() }]}>
          {percentage}%
        </Text>
      </View>
      
      <View style={styles.statsContainer}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{attended}</Text>
          <Text style={styles.statLabel}>Attended</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{total}</Text>
          <Text style={styles.statLabel}>Total Classes</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{remainingLeaves}</Text>
          <Text style={styles.statLabel}>Leaves Left</Text>
        </View>
      </View>
      
      <View style={[styles.messageContainer, { backgroundColor: getColor() + '20' }]}>
        <Text style={[styles.message, { color: getColor() }]}>{getMessage()}</Text>
      </View>
      
      <View style={styles.progressBarContainer}>
        <View style={[styles.progressBar, { width: `${percentage}%`, backgroundColor: getColor() }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 15,
    padding: 20,
    margin: 15,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 15,
  },
  percentageContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  percentage: {
    fontSize: 48,
    fontWeight: 'bold',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 5,
  },
  messageContainer: {
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
    alignItems: 'center',
  },
  message: {
    fontSize: 14,
    fontWeight: '600',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: colors.gray200,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
});