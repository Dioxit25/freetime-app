'use client'

import { useState, useEffect, useCallback } from 'react'
import React from 'react'
import { Calendar, Clock, Settings, Plus, Search, Users, User, ChevronDown, Loader2, Copy, Building2, BookOpen, Dumbbell, Gamepad2, Filter, Zap, GripVertical, Edit3, CalendarDays, Check, X, Trash2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import { DaySlotSheet } from '@/components/DaySlotSheet'

type SlotType = 'ONE_TIME' | 'CYCLIC_WEEKLY'
type SlotCategory = 'work' | 'study' | 'sport' | 'leisure' | 'other'

interface User {
  id: string
  telegramId: string
  firstName: string
  lastName?: string
  username?: string
  photoUrl?: string
  timezone: string
  languageCode: string
}

interface Group {
  id: string
  telegramChatId: string
  telegramTitle: string
  telegramPhotoUrl?: string
  tier: string
  memberCount: number
  joinedAt: Date
}

interface Slot {
  id: string
  userId: string
  type: SlotType
  description?: string
  startAt?: Date
  endAt?: Date
  dayOfWeek?: number
  startTimeLocal?: string
  endTimeLocal?: string
  timezone?: string
}

interface GroupMember {
  id: string
  userId: string
  user: User
}

// Slot categories
const slotCategories: Record<SlotCategory, {
  label: string;
  icon: any;
  bgColor: string;
  textColor: string;
  borderColor: string;
  prefix: string;
}> = {
  work: {
    label: 'Работа',
    icon: Building2,
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-200',
    prefix: '🏢',
  },
  study: {
    label: 'Учёба',
    icon: BookOpen,
    bgColor: 'bg-green-50',
    textColor: 'text-green-700',
    borderColor: 'border-green-200',
    prefix: '📚',
  },
  sport: {
    label: 'Спорт',
    icon: Dumbbell,
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-700',
    borderColor: 'border-orange-200',
    prefix: '🏃',
  },
  leisure: {
    label: 'Отдых',
    icon: Gamepad2,
    bgColor: 'bg-purple-50',
    textColor: 'text-purple-700',
    borderColor: 'border-purple-200',
    prefix: '🎮',
  },
  other: {
    label: 'Другое',
    icon: Clock,
    bgColor: 'bg-gray-50',
    textColor: 'text-gray-700',
    borderColor: 'border-gray-200',
    prefix: '',
  },
}

const daysOfWeek = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']  // JavaScript формат (0=Вс)
const daysOfWeekCalendar = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']  // Европейский формат для заголовков календаря
const daysOfWeekFull = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота']

export default function Home() {
  const [activeTab, setActiveTab] = useState('slots')
  const [user, setUser] = useState<User | null>(null)
  const [groups, setGroups] = useState<Group[]>([])
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  const [slots, setSlots] = useState<Slot[]>([])
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([])
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<{
    slots: any[],
    participants: { id: string; firstName: string; lastName?: string; username?: string; timezone?: string }[],
    count: number,
    timezones?: string[]
  } | null>(null)
  const [minDuration, setMinDuration] = useState(60)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [slotToDelete, setSlotToDelete] = useState<Slot | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [savingSlot, setSavingSlot] = useState(false)
  const [slotType, setSlotType] = useState<SlotType>('ONE_TIME')
  const [slotCategory, setSlotCategory] = useState<SlotCategory>('other')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('18:00')
  const [selectedDays, setSelectedDays] = useState<number[]>([])
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[] | null>(null) // null = все выбраны

  // Day slot sheet states
  const [isDaySheetOpen, setIsDaySheetOpen] = useState(false)
  const [daySheetDate, setDaySheetDate] = useState<Date | null>(null)

  // Get slot category from description
  const getSlotCategory = (desc?: string): SlotCategory => {
    if (!desc) return 'other'
    if (desc.includes('🏢')) return 'work'
    if (desc.includes('📚')) return 'study'
    if (desc.includes('🏃')) return 'sport'
    if (desc.includes('🎮')) return 'leisure'
    return 'other'
  }

  // Get clean description without prefix
  const getCleanDescription = (desc?: string): string => {
    if (!desc) return ''
    return desc.replace(/[^\p{L}\p{N}\s\.,;:!?@%$&*()_+=\-\[\]{}'"`<>`~`^|/\\]/gu, '').trim()
  }

  // Helper function for Russian plural forms
  const getNoun = (number: number, one: string, two: string, five: string) => {
    const n = Math.abs(number)
    const n10 = n % 10
    const n100 = n % 100

    if (n10 === 1 && n100 !== 11) return one
    if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return two
    return five
  }

  const getParticipantsText = (count: number) => {
    return `${count} ${getNoun(count, 'участник', 'участника', 'участников')}`
  }

  // Initialize app
  useEffect(() => {
    initializeApp()
  }, [])

  // Load data when group changes
  useEffect(() => {
    if (selectedGroup && user) {
      loadGroupData()
    }
  }, [selectedGroup, user])

  const initializeApp = async () => {
    console.log('🚀 App initialization started...')

    try {
      await new Promise(resolve => setTimeout(resolve, 100))

      let tgUser = (window as any).Telegram?.WebApp?.initDataUnsafe?.user
      let tgChat = (window as any).Telegram?.WebApp?.initDataUnsafe?.chat
      let startParam = (window as any).Telegram?.WebApp?.initDataUnsafe?.start_param

      // Check URL for startapp parameter
      if (!startParam) {
        const urlParams = new URLSearchParams(window.location.search)
        startParam = urlParams.get('startapp') || urlParams.get('tgWebAppStartParam')

        if (!startParam && window.location.hash.includes('startapp=')) {
          const match = window.location.hash.match(/startapp=([^&]*)/)
          if (match) startParam = match[1]
        }
      }

      console.log('📱 Telegram WebApp SDK check:', {
        hasTelegram: !!(window as any).Telegram,
        hasWebApp: !!((window as any).Telegram?.WebApp),
        hasUser: !!tgUser,
        hasChat: !!tgChat,
        startParam,
      })

      // Parse user from URL hash if not from SDK
      if (!tgUser && window.location.hash.includes('tgWebAppData')) {
        try {
          const hash = window.location.hash
          const tgWebAppDataMatch = hash.match(/tgWebAppData=([^&]*)/)
          if (tgWebAppDataMatch && tgWebAppDataMatch[1]) {
            const webAppData = decodeURIComponent(tgWebAppDataMatch[1])
            const dataParams = new URLSearchParams(webAppData)
            const userStr = dataParams.get('user')
            if (userStr) {
              tgUser = JSON.parse(userStr)
              console.log('✅ Parsed user from URL hash:', tgUser)
            }
          }
        } catch (e) {
          console.error('Error parsing URL hash:', e)
        }
      }

      if (!tgUser) {
        // Demo mode
        const demoUser = {
          id: 'demo-user',
          telegramId: '123456789',
          firstName: 'Демо',
          lastName: 'Пользователь',
          username: 'demo_user',
          photoUrl: undefined,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          languageCode: 'ru',
        }
        setUser(demoUser)

        const demoGroup = {
          id: 'demo-group',
          telegramChatId: '0',
          telegramTitle: 'Личная группа',
          tier: 'FREE',
          memberCount: 1,
          joinedAt: new Date(),
        }
        setGroups([demoGroup])
        setSelectedGroup(demoGroup)
      } else {
        await authenticateWithTelegram(tgUser, tgChat || (startParam ? { id: startParam } : null))
      }
    } catch (error) {
      console.error('Initialization error:', error)
      toast({
        title: 'Ошибка инициализации',
        description: 'Не удалось загрузить данные',
        variant: 'destructive',
      })
    } finally {
      setInitializing(false)
    }
  }

  const authenticateWithTelegram = async (tgUser: any, tgChat: any = null) => {
    try {
      const effectiveChat = tgChat || (window as any).Telegram?.WebApp?.initDataUnsafe?.chat
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone

      console.log('📱 Authenticating with timezone:', userTimezone)

      const response = await fetch('/api/auth/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: tgUser.id,
          firstName: tgUser.first_name,
          lastName: tgUser.last_name,
          username: tgUser.username,
          photoUrl: tgUser.photo_url,
          languageCode: tgUser.language_code,
          timezone: userTimezone,
          chatId: effectiveChat?.id,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        console.log('✅ Auth response:', data.user)
        setUser(data.user)
        setGroups(data.groups || [])

        if (data.groups && data.groups.length > 0) {
          setSelectedGroup(data.groups[0])
        }
      } else {
        const errorText = await response.text()
        console.error('❌ Auth failed:', response.status, errorText)
        toast({
          title: 'Ошибка авторизации',
          description: `Не удалось выполнить вход: ${errorText}`,
          variant: 'destructive',
        })
      }
    } catch (error: any) {
      console.error('❌ Auth error:', error)
      toast({
        title: 'Ошибка сети',
        description: error.message || 'Не удалось подключиться к серверу',
        variant: 'destructive',
      })
    }
  }

  const loadGroupData = async () => {
    if (!selectedGroup || !user) return

    try {
      await loadSlots()
    } catch (error) {
      console.error('Error loading group data:', error)
    }
  }

  const loadSlots = async () => {
    if (!selectedGroup || !user) return

    try {
      console.log('📂 Loading slots for user:', user.id)
      const response = await fetch(`/api/slots?userId=${user.id}`)
      if (response.ok) {
        const data = await response.json()
        const slotsWithDates = data.map((slot: any) => ({
          ...slot,
          startAt: slot.startAt ? new Date(slot.startAt) : undefined,
          endAt: slot.endAt ? new Date(slot.endAt) : undefined,
        }))
        setSlots(slotsWithDates)
        console.log(`✅ Loaded ${slotsWithDates.length} slots`)
      }
    } catch (error) {
      console.error('❌ Failed to load slots:', error)
    }
  }

  // Get slots for a specific date
  const getSlotsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0]
    return slots.filter(slot => {
      if (slot.type === 'ONE_TIME' && slot.startAt) {
        return slot.startAt.toISOString().split('T')[0] === dateStr
      }
      if (slot.type === 'CYCLIC_WEEKLY' && slot.dayOfWeek !== undefined) {
        return slot.dayOfWeek === date.getDay()
      }
      return false
    })
  }

  // Toggle day selection for cyclic slots
  const toggleDay = (day: number) => {
    setSelectedDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    )
  }

  // Save slot
  const handleSaveSlot = async () => {
    if (!selectedGroup || !user) {
      toast({ title: 'Ошибка', description: 'Выберите группу', variant: 'destructive' })
      return
    }

    if (user.id === 'demo-user' || selectedGroup.id === 'demo-group') {
      toast({
        title: 'Демо режим',
        description: 'В демо режиме нельзя сохранять слоты. Откройте приложение в Telegram WebApp.',
        variant: 'destructive'
      })
      return
    }

    if (!date && slotType === 'ONE_TIME') {
      toast({ title: 'Ошибка', description: 'Выберите дату', variant: 'destructive' })
      return
    }

    if (selectedDays.length === 0 && slotType === 'CYCLIC_WEEKLY') {
      toast({ title: 'Ошибка', description: 'Выберите хотя бы один день недели', variant: 'destructive' })
      return
    }

    setSavingSlot(true)

    try {
      const categoryPrefix = slotCategories[slotCategory].prefix
      const cleanDesc = getCleanDescription(description)
      let descriptionToSave: string | null = null

      if (cleanDesc && categoryPrefix) {
        descriptionToSave = `${categoryPrefix} ${cleanDesc}`
      } else if (cleanDesc) {
        descriptionToSave = cleanDesc
      } else if (categoryPrefix) {
        descriptionToSave = categoryPrefix
      }

      // Get user's timezone
      const userTimezone = user.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone

      if (slotType === 'CYCLIC_WEEKLY') {
        for (const day of selectedDays) {
          const response = await fetch('/api/slots', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user.id,
              type: 'CYCLIC_WEEKLY',
              description: descriptionToSave,
              dayOfWeek: day,
              startTimeLocal: startTime,
              endTimeLocal: endTime,
              timezone: userTimezone,
            }),
          })

          if (!response.ok) {
            throw new Error('Не удалось сохранить слот')
          }
        }
      } else {
        const startD = new Date(`${date}T${startTime}:00`)
        const endD = new Date(`${date}T${endTime}:00`)

        const response = await fetch('/api/slots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            type: 'ONE_TIME',
            description: descriptionToSave,
            startAt: startD.toISOString(),
            endAt: endD.toISOString(),
            startTimeLocal: startTime,
            endTimeLocal: endTime,
            timezone: userTimezone,
          }),
        })

        if (!response.ok) {
          throw new Error('Не удалось сохранить слот')
        }
      }

      toast({ title: 'Успешно', description: 'Время сохранено' })
      setIsDialogOpen(false)
      loadSlots()

      setDescription('')
      setSlotCategory('other')
      setDate('')
      setStartTime('09:00')
      setEndTime('18:00')
      setSelectedDays([])
    } catch (error: any) {
      console.error('❌ Failed to save slot:', error)
      toast({ title: 'Ошибка', description: error.message || 'Не удалось сохранить', variant: 'destructive' })
    } finally {
      setSavingSlot(false)
    }
  }

  // Delete slot
  const handleDeleteSlot = async () => {
    if (!slotToDelete) return

    setDeleteLoading(true)

    try {
      const response = await fetch(`/api/slots/${slotToDelete.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast({ title: 'Удалено', description: 'Слот успешно удалён' })
        setDeleteDialogOpen(false)
        setSlotToDelete(null)
        loadSlots()
      } else {
        throw new Error('Не удалось удалить')
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось удалить слот',
        variant: 'destructive'
      })
    } finally {
      setDeleteLoading(false)
    }
  }

  // Find common time
  const handleSearch = async () => {
    if (!selectedGroup) return

    setSearching(true)
    setSearchResults(null)

    try {
      const response = await fetch('/api/find-time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId: selectedGroup.id,
          daysToLookAhead: 7,
          minDuration: minDuration,
          userIds: selectedParticipantIds, // null = все, или массив ID
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setSearchResults(data)
        toast({
          title: 'Поиск завершен',
          description: `Найдено ${data.count} свободных слотов`,
        })
      } else {
        throw new Error('Ошибка поиска')
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось выполнить поиск',
        variant: 'destructive',
      })
    } finally {
      setSearching(false)
    }
  }

  // Format duration
  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) {
      return mins > 0 ? `${hours}ч ${mins}м` : `${hours}ч`
    }
    return `${mins}м`
  }

  // Render calendar
  const renderCalendar = () => {
    const today = new Date()
    const year = selectedDate.getFullYear()
    const month = selectedDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    // Конвертируем JS день недели (0=Вс) в европейский (0=Пн)
    // 0 (Вс) -> 6, 1 (Пн) -> 0, 2 (Вт) -> 1, и т.д.
    const jsDay = firstDay.getDay()
    const startPadding = jsDay === 0 ? 6 : jsDay - 1
    const daysInMonth = lastDay.getDate()

    const weeks: Date[][] = []
    let currentWeek: Date[] = []

    // Add padding for first week (дни предыдущего месяца)
    for (let i = startPadding - 1; i >= 0; i--) {
      const padDate = new Date(year, month, -i)
      currentWeek.push(padDate)
    }

    // Add days of month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day)
      currentWeek.push(date)

      if (currentWeek.length === 7) {
        weeks.push(currentWeek)
        currentWeek = []
      }
    }

    // Add remaining padding
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        const padDate = new Date(year, month + 1, currentWeek.length + 1)
        currentWeek.push(padDate)
      }
      weeks.push(currentWeek)
    }

    return (
      <div className="space-y-1">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 text-xs font-semibold text-gray-500">
          {daysOfWeekCalendar.map((day, i) => (
            <div key={i} className="text-center py-2">{day}</div>
          ))}
        </div>

        {/* Calendar weeks */}
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7 gap-1">
            {week.map((date, dayIndex) => {
              const isCurrentMonth = date.getMonth() === month
              const isToday = date.toDateString() === today.toDateString()
              const isSelected = date.toDateString() === selectedDate.toDateString()
              const daySlots = getSlotsForDate(date)
              const hasSlots = daySlots.length > 0

              return (
                <button
                  key={dayIndex}
                  onClick={() => {
                    setSelectedDate(date)
                    if (hasSlots || isToday) {
                      setDaySheetDate(date)
                      setIsDaySheetOpen(true)
                    }
                  }}
                  className={`
                    relative p-2 text-sm rounded-lg transition-all
                    ${isCurrentMonth ? 'text-gray-900' : 'text-gray-300'}
                    ${isToday ? 'ring-2 ring-blue-500' : ''}
                    ${isSelected ? 'bg-blue-100' : 'hover:bg-gray-50'}
                  `}
                >
                  {date.getDate()}
                  {hasSlots && (
                    <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                      {daySlots.slice(0, 3).map((_, i) => (
                        <div key={i} className="w-1 h-1 bg-blue-500 rounded-full" />
                      ))}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    )
  }

  // Render slots list
  const renderSlotsList = () => {
    const filteredSlots = slots.filter(slot => {
      if (slot.type === 'CYCLIC_WEEKLY') return true
      if (slot.type === 'ONE_TIME' && slot.startAt) {
        const slotDate = new Date(slot.startAt)
        return slotDate >= new Date()
      }
      return false
    })

    if (filteredSlots.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Нет сохранённых слотов</p>
          <p className="text-sm mt-1">Нажмите + чтобы добавить</p>
        </div>
      )
    }

    return (
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {filteredSlots.map(slot => {
          const category = getSlotCategory(slot.description)
          const catInfo = slotCategories[category]
          const cleanDesc = getCleanDescription(slot.description)

          return (
            <div
              key={slot.id}
              className={`p-3 rounded-lg border ${catInfo.bgColor} ${catInfo.borderColor}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">
                      {slot.type === 'CYCLIC_WEEKLY' 
                        ? daysOfWeekFull[slot.dayOfWeek || 0]
                        : slot.startAt?.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' })
                      }
                    </span>
                    <span className="text-sm text-gray-600">
                      {slot.startTimeLocal} - {slot.endTimeLocal}
                    </span>
                    {slot.timezone && slot.timezone !== 'UTC' && (
                      <span className="text-xs text-gray-400">
                        ({slot.timezone})
                      </span>
                    )}
                  </div>
                  {cleanDesc && (
                    <p className="text-sm text-gray-600 truncate">{cleanDesc}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                  onClick={() => {
                    setSlotToDelete(slot)
                    setDeleteDialogOpen(true)
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // Render search results
  const renderSearchResults = () => {
    if (searching) {
      return (
        <div className="text-center py-16">
          <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-blue-500" />
          <p className="text-gray-600 font-medium">Ищем пересечения...</p>
        </div>
      )
    }

    if (!searchResults) {
      return (
        <div className="text-center py-8">
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Users className="w-10 h-10 text-blue-500" />
          </div>
          <p className="text-gray-600 mb-2 font-medium">
            Найдите общее свободное время с участниками группы
          </p>
          <p className="text-sm text-gray-500 mb-4">
            Группа: {selectedGroup?.telegramTitle}
          </p>
          
          <div className="flex items-center justify-center gap-3 mb-6">
            <Label className="text-sm text-gray-600">Минимум:</Label>
            <Select value={minDuration.toString()} onValueChange={(v) => setMinDuration(parseInt(v))}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 минут</SelectItem>
                <SelectItem value="60">1 час</SelectItem>
                <SelectItem value="120">2 часа</SelectItem>
                <SelectItem value="180">3 часа</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleSearch}
            className="gap-2 bg-blue-500 hover:bg-blue-600"
          >
            <Search className="w-4 h-4" />
            Найти общее время
          </Button>
        </div>
      )
    }

    return (
      <div className="space-y-4">
        {/* Participants - clickable for selection */}
        {searchResults.participants && searchResults.participants.length > 0 && (
          <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                <span className="font-medium text-blue-900">Участники поиска:</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedParticipantIds(null)}
                className="text-xs text-blue-600 h-7"
              >
                Сбросить
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {searchResults.participants.map((p) => {
                const isSelected = selectedParticipantIds === null || selectedParticipantIds.includes(p.id)
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      if (selectedParticipantIds === null) {
                        // Изначально выбраны все - исключаем текущего
                        const others = searchResults.participants.filter(x => x.id !== p.id).map(x => x.id)
                        setSelectedParticipantIds(others.length === 0 ? null : others)
                      } else {
                        // Некоторые выбраны
                        if (selectedParticipantIds.includes(p.id)) {
                          // Убираем из выбора
                          const newSelection = selectedParticipantIds.filter(id => id !== p.id)
                          setSelectedParticipantIds(newSelection.length === 0 ? null : newSelection)
                        } else {
                          // Добавляем в выбор
                          setSelectedParticipantIds([...selectedParticipantIds, p.id])
                        }
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg border text-sm transition-all ${
                      isSelected
                        ? 'bg-white border-blue-400 shadow-sm'
                        : 'bg-gray-100 border-gray-200 opacity-50'
                    }`}
                  >
                    <span className={`font-medium ${isSelected ? 'text-gray-900' : 'text-gray-500'}`}>
                      {p.firstName}{p.lastName ? ` ${p.lastName}` : ''}
                    </span>
                    {p.timezone && (
                      <span className="text-xs text-gray-400 ml-1">({p.timezone})</span>
                    )}
                    {!isSelected && <span className="text-xs text-red-400 ml-1">✕</span>}
                  </button>
                )
              })}
            </div>
            {searchResults.timezones && searchResults.timezones.length > 0 && (
              <p className="text-xs text-blue-600 mt-2">
                Часовые пояса: {searchResults.timezones.join(', ')}
              </p>
            )}
          </div>
        )}

        {/* Results count with refresh button */}
        <div className="text-center flex items-center justify-center gap-2">
          <span>
            Найдено <span className="font-semibold text-gray-900">{searchResults.count}</span> свободных слотов
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSearch}
            disabled={searching}
            className="h-7 w-7 p-0"
          >
            <RefreshCw className={`w-4 h-4 ${searching ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Results list */}
        <div className="space-y-2">
          {searchResults.slots?.map((result: any, index: number) => {
            const startDate = new Date(result.start)
            const endDate = new Date(result.end)

            return (
              <div
                key={index}
                className="p-4 rounded-xl border border-green-200 bg-green-50"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">
                      {startDate.toLocaleDateString('ru-RU', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short'
                      })}
                    </div>
                    <div className="text-sm text-gray-600">
                      {startDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                      {' — '}
                      {endDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-green-600">
                      {formatDuration(result.durationMinutes)}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  if (initializing) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-md mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <User className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="font-semibold text-gray-900">
                  {user?.firstName} {user?.lastName}
                </div>
                <div className="text-xs text-gray-500">
                  {user?.timezone || 'UTC'}
                </div>
              </div>
            </div>
            
            {groups.length > 0 && (
              <Select
                value={selectedGroup?.id}
                onValueChange={(v) => {
                  const group = groups.find(g => g.id === v)
                  if (group) {
                    setSelectedGroup(group)
                    setSelectedParticipantIds(null) // Сброс выбора участников при смене группы
                    setSearchResults(null) // Сброс результатов поиска
                  }
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Выберите группу" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map(group => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.telegramTitle}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-md mx-auto px-4 py-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="slots">
              <Calendar className="w-4 h-4 mr-2" />
              Слоты
            </TabsTrigger>
            <TabsTrigger value="find">
              <Search className="w-4 h-4 mr-2" />
              Поиск
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="w-4 h-4 mr-2" />
              Настройки
            </TabsTrigger>
          </TabsList>

          <TabsContent value="slots" className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>Календарь</span>
                  <span className="text-sm font-normal text-gray-500">
                    {selectedDate.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {renderCalendar()}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Мои слоты</CardTitle>
                  <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="gap-2 bg-blue-500 hover:bg-blue-600">
                        <Plus className="w-4 h-4" />
                        Добавить
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                      <DialogHeader>
                        <DialogTitle>Добавить занятое время</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        {/* Category selection */}
                        <div>
                          <Label className="text-sm font-medium">Категория</Label>
                          <div className="grid grid-cols-5 gap-2 mt-2">
                            {(Object.keys(slotCategories) as SlotCategory[]).map((cat) => {
                              const catData = slotCategories[cat]
                              const Icon = catData.icon
                              return (
                                <button
                                  key={cat}
                                  onClick={() => setSlotCategory(cat)}
                                  className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all ${
                                    slotCategory === cat
                                      ? `${catData.bgColor} ${catData.textColor} ${catData.borderColor}`
                                      : 'bg-white border-gray-200 hover:border-gray-300'
                                  }`}
                                >
                                  <Icon className="w-5 h-5" />
                                  <span className="text-xs">{catData.label}</span>
                                </button>
                              )
                            })}
                          </div>
                        </div>

                        {/* Description */}
                        <div>
                          <Label className="text-sm font-medium">Описание</Label>
                          <Input
                            placeholder="Например: Работа, Встреча"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="mt-2"
                          />
                        </div>

                        {/* Type */}
                        <div>
                          <Label className="text-sm font-medium">Тип</Label>
                          <Select value={slotType} onValueChange={(v: SlotType) => setSlotType(v)}>
                            <SelectTrigger className="mt-2">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ONE_TIME">Одноразово</SelectItem>
                              <SelectItem value="CYCLIC_WEEKLY">Каждую неделю</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Date or days */}
                        {slotType === 'ONE_TIME' ? (
                          <div>
                            <Label className="text-sm font-medium">Дата</Label>
                            <Input
                              type="date"
                              value={date}
                              onChange={(e) => setDate(e.target.value)}
                              className="mt-2"
                            />
                          </div>
                        ) : (
                          <div>
                            <Label className="text-sm font-medium mb-2 block">Дни недели</Label>
                            <div className="flex gap-1">
                              {daysOfWeek.map((day, jsDay) => (
                                <button
                                  key={jsDay}
                                  onClick={() => toggleDay(jsDay)}
                                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all border-2
                                    ${selectedDays.includes(jsDay)
                                      ? 'bg-blue-500 border-blue-500 text-white'
                                      : 'bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200'
                                    }
                                  `}
                                >
                                  {day}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Time */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-sm font-medium">С</Label>
                            <Input
                              type="time"
                              value={startTime}
                              onChange={(e) => setStartTime(e.target.value)}
                              className="mt-2"
                            />
                          </div>
                          <div>
                            <Label className="text-sm font-medium">До</Label>
                            <Input
                              type="time"
                              value={endTime}
                              onChange={(e) => setEndTime(e.target.value)}
                              className="mt-2"
                            />
                          </div>
                        </div>

                        {/* Timezone info */}
                        <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
                          Часовой пояс: <span className="font-medium">{user?.timezone || 'UTC'}</span>
                        </div>

                        <Button
                          onClick={handleSaveSlot}
                          disabled={savingSlot}
                          className="w-full bg-blue-500 hover:bg-blue-600"
                        >
                          {savingSlot && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          Сохранить
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {renderSlotsList()}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="find">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Найти общее время</CardTitle>
              </CardHeader>
              <CardContent>
                {renderSearchResults()}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Настройки</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Часовой пояс</Label>
                  <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium">{user?.timezone || 'UTC'}</span>
                    <p className="text-xs text-gray-500 mt-1">
                      Определяется автоматически из браузера
                    </p>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium">Участников в группе</Label>
                  <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium">{selectedGroup?.memberCount || 1}</span>
                  </div>
                </div>

                {user?.id === 'demo-user' && (
                  <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                    <p className="text-sm text-yellow-800">
                      ⚠️ Демо режим. Откройте приложение в Telegram для полноценной работы.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить слот?</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-gray-600">
              Это действие нельзя отменить. Слот будет удалён навсегда.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              className="flex-1"
            >
              Отмена
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteSlot}
              disabled={deleteLoading}
              className="flex-1"
            >
              {deleteLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Удалить
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Day slot sheet */}
      <DaySlotSheet
        open={isDaySheetOpen}
        onOpenChange={setIsDaySheetOpen}
        selectedDate={daySheetDate}
        slots={slots}
        userId={user?.id || null}
        userTimezone={user?.timezone}
        onSlotsChange={loadSlots}
      />
    </div>
  )
}
