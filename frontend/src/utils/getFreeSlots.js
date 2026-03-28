const DAY_START = "09:00";
const DAY_END = "17:00";
const WEEK_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function toMinutes(time) {
  if (typeof time !== "string" || !/^\d{2}:\d{2}$/.test(time)) {
    return null;
  }

  const [hours, minutes] = time.split(":").map(Number);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return hours * 60 + minutes;
}

function toHHMM(totalMinutes) {
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const minutes = String(totalMinutes % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function toMinutesFlexible(time) {
  if (typeof time !== "string") {
    return null;
  }

  const trimmed = time.trim().toUpperCase();
  const ampmMatch = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (ampmMatch) {
    let hours = Number(ampmMatch[1]);
    const minutes = Number(ampmMatch[2]);
    const meridiem = ampmMatch[3];

    if (hours === 12) {
      hours = meridiem === "AM" ? 0 : 12;
    } else if (meridiem === "PM") {
      hours += 12;
    }

    return hours * 60 + minutes;
  }

  return toMinutes(trimmed);
}

function normalizeRange(range) {
  return range
    .replace(/\s+/g, " ")
    .replace(/\./g, ":")
    .replace(/\s*to\s*/gi, " - ")
    .trim();
}

function parseTimeLabel(timeLabel) {
  if (typeof timeLabel !== "string") {
    return null;
  }

  let label = normalizeRange(timeLabel);
  let day = "General";

  for (const weekDay of WEEK_DAYS) {
    if (label.startsWith(`${weekDay} `)) {
      day = weekDay;
      label = label.slice(weekDay.length).trim();
      break;
    }
  }

  const [startRaw, endRaw] = label.split(/\s*-\s*/);
  if (!startRaw || !endRaw) {
    return null;
  }

  const start = toMinutesFlexible(startRaw);
  const end = toMinutesFlexible(endRaw);
  if (start === null || end === null) {
    return null;
  }

  return {
    day,
    start,
    end,
  };
}

export function getFreeSlots(timetable) {
  const dayStartMinutes = toMinutes(DAY_START);
  const dayEndMinutes = toMinutes(DAY_END);

  const classes = timetable
    .map((item) => ({
      subject: item.subject,
      start: toMinutes(item.start),
      end: toMinutes(item.end),
    }))
    .filter(
      (item) =>
        item.start !== null &&
        item.end !== null &&
        item.start < item.end &&
        item.start >= dayStartMinutes &&
        item.end <= dayEndMinutes,
    )
    .sort((first, second) => first.start - second.start);

  const nonOverlappingClasses = [];
  for (const currentClass of classes) {
    const previousClass = nonOverlappingClasses[nonOverlappingClasses.length - 1];
    if (!previousClass || currentClass.start >= previousClass.end) {
      nonOverlappingClasses.push(currentClass);
    }
  }

  if (nonOverlappingClasses.length === 0) {
    return [
      {
        start: DAY_START,
        end: DAY_END,
        duration: dayEndMinutes - dayStartMinutes,
      },
    ];
  }

  const freeSlots = [];
  let currentPointer = dayStartMinutes;

  for (const currentClass of nonOverlappingClasses) {
    if (currentClass.start > currentPointer) {
      freeSlots.push({
        start: toHHMM(currentPointer),
        end: toHHMM(currentClass.start),
        duration: currentClass.start - currentPointer,
      });
    }

    currentPointer = currentClass.end;
  }

  if (currentPointer < dayEndMinutes) {
    freeSlots.push({
      start: toHHMM(currentPointer),
      end: toHHMM(dayEndMinutes),
      duration: dayEndMinutes - currentPointer,
    });
  }

  return freeSlots;
}

export function getFreeSlotsByDay(entries) {
  const grouped = new Map();

  for (const entry of entries) {
    const parsed = parseTimeLabel(entry.time);
    if (!parsed || parsed.start >= parsed.end) {
      continue;
    }

    if (!grouped.has(parsed.day)) {
      grouped.set(parsed.day, []);
    }

    grouped.get(parsed.day).push({
      subject: entry.subject_name,
      start: toHHMM(parsed.start),
      end: toHHMM(parsed.end),
    });
  }

  return [...grouped.entries()]
    .sort(([firstDay], [secondDay]) => {
      const firstIndex = WEEK_DAYS.indexOf(firstDay);
      const secondIndex = WEEK_DAYS.indexOf(secondDay);
      return (firstIndex === -1 ? 99 : firstIndex) - (secondIndex === -1 ? 99 : secondIndex);
    })
    .map(([day, timetable]) => ({
      day,
      slots: getFreeSlots(timetable),
    }));
}
