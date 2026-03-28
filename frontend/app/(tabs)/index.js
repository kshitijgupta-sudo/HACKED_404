import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Colors
const colors = {
  primary: '#4CAF50',
  primaryDark: '#388E3C',
  primaryLight: '#81C784',
  warning: '#FF9800',
  danger: '#F44336',
  info: '#2196F3',
  white: '#FFFFFF',
  black: '#000000',
  gray100: '#F5F5F5',
  gray200: '#EEEEEE',
  gray300: '#E0E0E0',
  gray400: '#BDBDBD',
  gray500: '#9E9E9E',
  gray600: '#757575',
  gray700: '#616161',
  textPrimary: '#212121',
  textSecondary: '#757575',
  background: '#F5F5F5',
  surface: '#FFFFFF',
};

export default function DashboardScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [userName, setUserName] = useState('Student');
  const [greeting, setGreeting] = useState('');
  const [attendance, setAttendance] = useState({
    percentage: 78,
    attended: 39,
    total: 50,
    remainingLeaves: 8,
    maxLeaves: 13, // 25% of total
  });
  const [todayClasses, setTodayClasses] = useState([
    { id: 1, name: 'Data Structures', time: '09:00 - 10:30', room: 'CSE-101', teacher: 'Dr. Sharma', marked: true },
    { id: 2, name: 'Database Systems', time: '10:45 - 12:15', room: 'CSE-102', teacher: 'Prof. Gupta', marked: false },
    { id: 3, name: 'Operating Systems', time: '14:00 - 15:30', room: 'CSE-103', teacher: 'Dr. Patel', marked: false },
  ]);
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState({
    totalClasses: 50,
    attendedClasses: 39,
    missedClasses: 11,
    thisWeekAttendance: 82,
  });

  useEffect(() => {
    loadUserData();
    setGreetingMessage();
    checkAlerts();
  }, []);

  const loadUserData = async () => {
    try {
      const userStr = await AsyncStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        setUserName(user.name || user.email?.split('@')[0] || 'Student');
      }
    } catch (error) {
      console.error('Failed to load user:', error);
    }
  };

  const setGreetingMessage = () => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good Morning 🌅');
    else if (hour < 17) setGreeting('Good Afternoon ☀️');
    else if (hour < 21) setGreeting('Good Evening 🌙');
    else setGreeting('Good Night 🌟');
  };

  const checkAlerts = () => {
    const newAlerts = [];
    
    // Attendance alert
    if (attendance.percentage < 75) {
      newAlerts.push({
        id: 1,
        type: 'danger',
        title: '⚠️ Low Attendance Warning!',
        message: `Your attendance is ${attendance.percentage}%. Maintain at least 75% to avoid debarment.`,
        action: 'View Details',
      });
    } else if (attendance.percentage < 80) {
      newAlerts.push({
        id: 1,
        type: 'warning',
        title: '⚡ Attendance Alert',
        message: `You have ${attendance.remainingLeaves} leaves remaining. Plan wisely!`,
        action: 'Calculate',
      });
    }
    
    // Check for upcoming classes
    const upcomingClass = todayClasses.find(c => !c.marked);
    if (upcomingClass) {
      newAlerts.push({
        id: 2,
        type: 'info',
        title: '📚 Upcoming Class',
        message: `${upcomingClass.name} at ${upcomingClass.time} in ${upcomingClass.room}`,
        action: 'Mark Attendance',
      });
    }
    
    setAlerts(newAlerts);
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // Simulate fetching fresh data
    setTimeout(() => {
      setRefreshing(false);
      checkAlerts();
    }, 1000);
  }, []);

  const getAttendanceColor = () => {
    if (attendance.percentage >= 75) return colors.primary;
    if (attendance.percentage >= 60) return colors.warning;
    return colors.danger;
  };

  const getAttendanceMessage = () => {
    if (attendance.percentage >= 90) return '🎉 Excellent! Keep it up!';
    if (attendance.percentage >= 75) return '✅ Safe Zone';
    if (attendance.percentage >= 60) return '⚠️ Below 75% - Take action!';
    return '🔴 Critical! Contact HOD immediately';
  };

  const handleMarkAttendance = () => {
    router.push('/attendance');
  };

  const handleViewTimetable = () => {
    router.push('/timetable');
  };

  const handleViewFreeSlots = () => {
    router.push('/freeslots');
  };

  const handleAlertAction = (alert) => {
    if (alert.title.includes('Attendance')) {
      router.push('/attendance');
    } else if (alert.title.includes('Upcoming')) {
      router.push('/attendance');
    }
  };

  const getInitials = () => {
    return userName.charAt(0).toUpperCase();
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Header Section */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>{greeting}</Text>
            <Text style={styles.userName}>{userName}</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials()}</Text>
          </View>
        </View>
        <Text style={styles.tagline}>Attend smarter. Learn faster. Connect better.</Text>
      </View>

      {/* Attendance Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📊 Attendance Overview</Text>
        
        <View style={styles.percentageContainer}>
          <Text style={[styles.percentage, { color: getAttendanceColor() }]}>
            {attendance.percentage}%
          </Text>
        </View>
        
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{attendance.attended}</Text>
            <Text style={styles.statLabel}>Attended</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{attendance.total}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.warning }]}>
              {attendance.remainingLeaves}
            </Text>
            <Text style={styles.statLabel}>Leaves Left</Text>
          </View>
        </View>
        
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { width: `${attendance.percentage}%`, backgroundColor: getAttendanceColor() }
              ]} 
            />
          </View>
          <Text style={styles.progressText}>
            {attendance.percentage}% - {getAttendanceMessage()}
          </Text>
        </View>
        
        <View style={styles.leaveInfo}>
          <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.leaveInfoText}>
            Maximum {attendance.maxLeaves} leaves allowed per semester
          </Text>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⚡ Quick Actions</Text>
        <View style={styles.quickActionsGrid}>
          <TouchableOpacity style={styles.actionCard} onPress={handleMarkAttendance}>
            <View style={[styles.actionIcon, { backgroundColor: colors.primary + '20' }]}>
              <Ionicons name="camera" size={28} color={colors.primary} />
            </View>
            <Text style={styles.actionLabel}>Mark Attendance</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionCard} onPress={handleViewTimetable}>
            <View style={[styles.actionIcon, { backgroundColor: colors.info + '20' }]}>
              <Ionicons name="calendar" size={28} color={colors.info} />
            </View>
            <Text style={styles.actionLabel}>View Timetable</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionCard} onPress={handleViewFreeSlots}>
            <View style={[styles.actionIcon, { backgroundColor: colors.warning + '20' }]}>
              <Ionicons name="people" size={28} color={colors.warning} />
            </View>
            <Text style={styles.actionLabel}>Find Study Buddies</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionCard}>
            <View style={[styles.actionIcon, { backgroundColor: colors.danger + '20' }]}>
              <Ionicons name="stats-chart" size={28} color={colors.danger} />
            </View>
            <Text style={styles.actionLabel}>Analytics</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Alerts Section */}
      {alerts.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔔 Alerts & Notifications</Text>
          {alerts.map((alert) => (
            <TouchableOpacity 
              key={alert.id} 
              style={[
                styles.alertCard,
                alert.type === 'danger' && styles.alertDanger,
                alert.type === 'warning' && styles.alertWarning,
                alert.type === 'info' && styles.alertInfo,
              ]}
              onPress={() => handleAlertAction(alert)}
            >
              <View style={styles.alertContent}>
                <Text style={styles.alertTitle}>{alert.title}</Text>
                <Text style={styles.alertMessage}>{alert.message}</Text>
                {alert.action && (
                  <Text style={styles.alertAction}>{alert.action} →</Text>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Today's Classes */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>📖 Today's Classes</Text>
          <TouchableOpacity onPress={handleViewTimetable}>
            <Text style={styles.viewAll}>View All →</Text>
          </TouchableOpacity>
        </View>
        
        {todayClasses.map((classItem) => (
          <View key={classItem.id} style={styles.classCard}>
            <View style={styles.classInfo}>
              <View>
                <Text style={styles.className}>{classItem.name}</Text>
                <Text style={styles.classDetail}>
                  <Ionicons name="time-outline" size={12} /> {classItem.time}
                </Text>
                <Text style={styles.classDetail}>
                  <Ionicons name="location-outline" size={12} /> {classItem.room}
                </Text>
                <Text style={styles.classDetail}>
                  <Ionicons name="person-outline" size={12} /> {classItem.teacher}
                </Text>
              </View>
              {classItem.marked ? (
                <View style={styles.markedBadge}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                  <Text style={styles.markedText}>Marked</Text>
                </View>
              ) : (
                <TouchableOpacity 
                  style={styles.markButton}
                  onPress={handleMarkAttendance}
                >
                  <Text style={styles.markButtonText}>Mark</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
      </View>

      {/* Stats Section */}
      <View style={[styles.section, styles.lastSection]}>
        <Text style={styles.sectionTitle}>📈 Weekly Stats</Text>
        <View style={styles.statsCard}>
          <View style={styles.statsGrid}>
            <View style={styles.statsGridItem}>
              <Text style={styles.statsGridValue}>{stats.thisWeekAttendance}%</Text>
              <Text style={styles.statsGridLabel}>This Week</Text>
            </View>
            <View style={styles.statsGridItem}>
              <Text style={styles.statsGridValue}>{stats.missedClasses}</Text>
              <Text style={styles.statsGridLabel}>Missed</Text>
            </View>
            <View style={styles.statsGridItem}>
              <Text style={styles.statsGridValue}>{attendance.total - stats.attendedClasses}</Text>
              <Text style={styles.statsGridLabel}>To Attend</Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.primary,
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 25,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  greeting: {
    fontSize: 14,
    color: colors.white + 'CC',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.white,
    marginTop: 4,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.white + '30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.white,
  },
  tagline: {
    fontSize: 12,
    color: colors.white + 'CC',
    marginTop: 5,
  },
  card: {
    backgroundColor: colors.surface,
    margin: 15,
    marginTop: -10,
    padding: 20,
    borderRadius: 20,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  cardTitle: {
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
    fontSize: 56,
    fontWeight: 'bold',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
    paddingVertical: 15,
    backgroundColor: colors.gray100,
    borderRadius: 15,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.gray300,
  },
  progressContainer: {
    marginBottom: 15,
  },
  progressBar: {
    height: 10,
    backgroundColor: colors.gray200,
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
  },
  progressText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  leaveInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
  },
  leaveInfoText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: 5,
  },
  section: {
    marginHorizontal: 15,
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  viewAll: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '500',
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionCard: {
    width: '23%',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  actionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  alertCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginBottom: 10,
    padding: 15,
    borderLeftWidth: 4,
  },
  alertDanger: {
    borderLeftColor: colors.danger,
    backgroundColor: colors.danger + '10',
  },
  alertWarning: {
    borderLeftColor: colors.warning,
    backgroundColor: colors.warning + '10',
  },
  alertInfo: {
    borderLeftColor: colors.info,
    backgroundColor: colors.info + '10',
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  alertMessage: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  alertAction: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '500',
  },
  classCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginBottom: 10,
    padding: 15,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  classInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  className: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  classDetail: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  markedBadge: {
    alignItems: 'center',
  },
  markedText: {
    fontSize: 11,
    color: colors.primary,
    marginTop: 2,
  },
  markButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  markButtonText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '600',
  },
  lastSection: {
    marginBottom: 30,
  },
  statsCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 15,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statsGridItem: {
    alignItems: 'center',
  },
  statsGridValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.primary,
  },
  statsGridLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
});