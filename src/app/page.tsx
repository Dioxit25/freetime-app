'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import React from 'react'
import { Calendar, Clock, Settings, Plus, LogOut, Search, Users, User, ChevronDown, Loader2, Copy, Building2, BookOpen, Dumbbell, Gamepad2, Filter, Zap, GripVertical, Edit3, CalendarDays, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'

type SlotType = 'ONE_TIME' | 'CYCLIC_WEEKLY'
type SlotCategory = 'work' | 'study' | 'sport' | 'leisure' | 'other'
type CalendarView = 'month' | 'week'

interface User {
  id: string
  telegramId: number
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
  groupId: string
  type: SlotType
  description?: string
  startAt?: Date
  endAt?: Date
  dayOfWeek?: number
  startTimeLocal?: string
  endTimeLocal?: string
  user?: User
}

interface GroupMember {
  id: string
  userId: string
  user: User
}

// Slot categories with minimal light design
const slotCategories: Record<SlotCategory, {
  label: string;
  icon: any;
  bgColor: string;
  textColor: string;
  borderColor: string;
  prefix: string;
  gradient: string;
  shadowColor: string;
}> = {
  work: {
    label: 'Работа',
    icon: Building2,
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-200',
    prefix: '🏢',
    gradient: 'from-blue-500 to-blue-600',
    shadowColor: 'shadow-blue-500/20',
  },
  study: {
    label: 'Учёба',
    icon: BookOpen,
    bgColor: 'bg-green-50',
    textColor: 'text-green-700',
    borderColor: 'border-green-200',
    prefix: '📚',
    gradient: 'from-green-500 to-green-600',
    shadowColor: 'shadow-green-500/20',
  },
  sport: {
    label: 'Спорт',
    icon: Dumbbell,
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-700',
    borderColor: 'border-orange-200',
    prefix: '🏃',
    gradient: 'from-orange-500 to-orange-600',
    shadowColor: 'shadow-orange-500/20',
  },
  leisure: {
    label: 'Отдых',
    icon: Gamepad2,
    bgColor: 'bg-purple-50',
    textColor: 'text-purple-700',
    borderColor: 'border-purple-200',
    prefix: '🎮',
    gradient: 'from-purple-500 to-purple-600',
    shadowColor: 'shadow-purple-500/20',
  },
  other: {
    label: 'Другое',
    icon: Clock,
    bgColor: 'bg-gray-50',
    textColor: 'text-gray-700',
    borderColor: 'border-gray-200',
    prefix: '',
    gradient: 'from-gray-500 to-gray-600',
    shadowColor: 'shadow-gray-500/20',
  },
}

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
  const [searchResults, setSearchResults] = useState<any[]>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [slotToDelete, setSlotToDelete] = useState<Slot | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [groupMenuOpen, setGroupMenuOpen] = useState(false)
  const [savingSlot, setSavingSlot] = useState(false)
  const [slotType, setSlotType] = useState<SlotType>('ONE_TIME')
  const [slotCategory, setSlotCategory] = useState<SlotCategory>('other')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('18:00')
  const [selectedDays, setSelectedDays] = useState<number[]>([])
  const [copyDialogOpen, setCopyDialogOpen] = useState(false)
  const [slotToCopy, setSlotToCopy] = useState<Slot | null>(null)
  const [copyDate, setCopyDate] = useState('')
  const [copyAllWeek, setCopyAllWeek] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState<SlotCategory | 'all'>('all')
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null)
  const [showQuickView, setShowQuickView] = useState(false)
  const quickViewRef = useRef<HTMLDivElement>(null)
  
  // New states for modern features
  const [calendarView, setCalendarView] = useState<CalendarView>('month')
  const [selectedDates, setSelectedDates] = useState<Date[]>([])
  const [draggedSlot, setDraggedSlot] = useState<Slot | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dropTargetDate, setDropTargetDate] = useState<Date | null>(null)
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null)
  const [editingDescription, setEditingDescription] = useState('')
  const [editingStartTime, setEditingStartTime] = useState('')
  const [editingEndTime, setEditingEndTime] = useState('')
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null)
  const [isLongPress, setIsLongPress] = useState(false)

  const daysOfWeek = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
  const daysOfWeekFull = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье']

  // Convert JavaScript day (0=Sunday, 1=Monday...) to Monday-first display index (0=Monday, 6=Sunday)
  const jsDayToDisplayDay = (jsDay: number) => (jsDay + 6) % 7

  // Get slot category from description
  const getSlotCategory = (desc?: string): SlotCategory => {
    if (!desc) return 'other'
    if (desc.includes('🏢')) return 'work'
    if (desc.includes('📚')) return 'study'
    if (desc.includes('🏃')) return 'sport'
    if (desc.includes('🎮')) return 'leisure'
    return 'other'
  }

  // Get clean description without prefix - removes emojis and special characters
  const getCleanDescription = (desc?: string): string => {
    if (!desc) return ''
    return desc.replace(/[^\p{L}\p{N}\s\.,;:!?@%$&*()_+=\-\[\]{}'"`<>`~`^|/\\]/g, '').trim()
  }

  // Helper function for Russian plural forms
  const getNoun = (number: number, one: string, two: string, five: string) => {
    const n = Math.abs(number)
    const n10 = n % 10
    const n100 = n % 100

    if (n10 === 1 && n100 !== 11) {
      return one
    }
    if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) {
      return two
    }
    return five
  }

  const getParticipantsText = (count: number) => {
    return `${count} ${getNoun(count, 'участник', 'участника', 'участников')}`
  }

  // Haptic feedback function for mobile devices (modern touch feedback)
  const triggerHaptic = (pattern: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error') => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      switch (pattern) {
        case 'light':
          navigator.vibrate(10)
          break
        case 'medium':
          navigator.vibrate(25)
          break
        case 'heavy':
          navigator.vibrate(50)
          break
        case 'success':
          navigator.vibrate([10, 30, 10])
          break
        case 'warning':
          navigator.vibrate([20, 40])
          break
        case 'error':
          navigator.vibrate([30, 50, 30])
          break
      }
    }
  }

  // Get current time position for Week View (in percentage)
  const getCurrentTimePosition = () => {
    const now = new Date()
    const hour = now.getHours()
    const minute = now.getMinutes()
    const startHour = 6
    const endHour = 23
    const totalHours = endHour - startHour + 1
    
    if (hour < startHour || hour > endHour) return null
    
    const hoursPassed = hour - startHour
    const minutesPassed = minute / 60
    const position = ((hoursPassed + minutesPassed) / totalHours) * 100
    
    return position
  }

  // Quick templates for common time slots
  const quickTemplates = [
    { name: 'Рабочий день', startTime: '09:00', endTime: '18:00', category: 'work' as SlotCategory, icon: Building2 },
    { name: 'Учёба', startTime: '09:00', endTime: '15:00', category: 'study' as SlotCategory, icon: BookOpen },
    { name: 'Спорт', startTime: '18:00', endTime: '20:00', category: 'sport' as SlotCategory, icon: Dumbbell },
    { name: 'Вечер', startTime: '20:00', endTime: '23:00', category: 'leisure' as SlotCategory, icon: Gamepad2 },
  ]

  // Apply quick template
  const applyTemplate = (template: typeof quickTemplates[0]) => {
    setSlotCategory(template.category)
    setStartTime(template.startTime)
    setEndTime(template.endTime)
  }

  // Copy slot to another day
  const openCopyDialog = (slot: Slot) => {
    setSlotToCopy(slot)
    setCopyDate('')
    setCopyAllWeek(false)
    setCopyDialogOpen(true)
  }

  const handleCopySlot = async () => {
    if (!slotToCopy || !user || !selectedGroup) return

    if (user.id === 'demo-user' || selectedGroup.id === 'demo-group') {
      toast({
        title: 'Демо режим',
        description: 'В демо режиме нельзя копировать слоты',
        variant: 'destructive'
      })
      return
    }

    if (copyAllWeek) {
      for (let jsDay = 1; jsDay <= 5; jsDay++) {
        const response = await fetch('/api/slots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            groupId: selectedGroup.id,
            type: 'CYCLIC_WEEKLY',
            description: slotToCopy.description,
            dayOfWeek: jsDay,
            startTimeLocal: slotToCopy.startTimeLocal,
            endTimeLocal: slotToCopy.endTimeLocal,
          }),
        })
        if (!response.ok) {
          throw new Error('Не удалось скопировать слот')
        }
      }
      toast({ title: 'Успешно', description: 'Слот скопирован на рабочие дни недели' })
    } else {
      if (!copyDate) {
        toast({ title: 'Ошибка', description: 'Выберите дату', variant: 'destructive' })
        return
      }
      const startD = new Date(`${copyDate}T${slotToCopy.startTimeLocal}:00`)
      const endD = new Date(`${copyDate}T${slotToCopy.endTimeLocal}:00`)
      const response = await fetch('/api/slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          groupId: selectedGroup.id,
          type: 'ONE_TIME',
          description: slotToCopy.description,
          startAt: startD.toISOString(),
          endAt: endD.toISOString(),
          startTimeLocal: slotToCopy.startTimeLocal,
          endTimeLocal: slotToCopy.endTimeLocal,
        }),
      })
      if (!response.ok) {
        throw new Error('Не удалось скопировать слот')
      }
      toast({ title: 'Успешно', description: 'Слот скопирован' })
    }

    setCopyDialogOpen(false)
    setSlotToCopy(null)
    loadSlots()
  }

  // Get slots for a specific date (must be defined before functions that use it)
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

  // Filter slots based on search query and category
  const getFilteredSlots = (date?: Date) => {
    let filteredSlots = date ? getSlotsForDate(date) : slots

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filteredSlots = filteredSlots.filter(slot => {
        const cleanDesc = getCleanDescription(slot.description).toLowerCase()
        return cleanDesc.includes(query)
      })
    }

    if (filterCategory !== 'all') {
      filteredSlots = filteredSlots.filter(slot => {
        const category = getSlotCategory(slot.description)
        return category === filterCategory
      })
    }

    return filteredSlots
  }



  // Initialize app
  useEffect(() => {
    initializeApp()
  }, [])

  // Load data when group changes
  useEffect(() => {
    if (selectedGroup) {
      loadGroupData()
    }
  }, [selectedGroup, user])

  // Clean up long press timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer)
      }
    }
  }, [longPressTimer])

  const initializeApp = async () => {
    console.log('🚀 App initialization started...')

    try {
      await new Promise(resolve => setTimeout(resolve, 100))

      let tgUser = (window as any).Telegram?.WebApp?.initDataUnsafe?.user
      let tgChat = (window as any).Telegram?.WebApp?.initDataUnsafe?.chat

      console.log('📱 Telegram WebApp SDK check:', {
        hasTelegram: !!(window as any).Telegram,
        hasWebApp: !!((window as any).Telegram?.WebApp),
        hasInitDataUnsafe: !!((window as any).Telegram?.WebApp?.initDataUnsafe),
        hasUser: !!tgUser,
        hasChat: !!tgChat,
        user: tgUser,
        chat: tgChat,
      })

      if (!tgUser && window.location.hash.includes('tgWebAppData')) {
        try {
          const hash = window.location.hash
          const tgWebAppDataMatch = hash.match(/tgWebAppData=([^&]*)/)
          if (tgWebAppDataMatch && tgWebAppDataMatch[1]) {
            const webAppData = tgWebAppDataMatch[1]
            const decodedData = decodeURIComponent(webAppData)
            const dataParams = new URLSearchParams(decodedData)

            const userStr = dataParams.get('user')
            if (userStr) {
              try {
                tgUser = JSON.parse(userStr)
                console.log('✅ Parsed user from URL hash:', tgUser)
              } catch (e) {
                console.error('Error parsing user from URL hash:', e)
              }
            }
          }
        } catch (e) {
          console.error('Error parsing URL hash:', e)
        }
      }

      if (!tgUser) {
        const demoUser = {
          id: 'demo-user',
          telegramId: 123456789,
          firstName: 'Демо',
          lastName: 'Пользователь',
          username: 'demo_user',
          photoUrl: undefined,
          timezone: 'Europe/Moscow',
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
        await authenticateWithTelegram(tgUser, tgChat)
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

      console.log('📱 Telegram WebApp data:', {
        user: tgUser,
        chat: effectiveChat,
        chatId: effectiveChat?.id,
      })

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
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          chatId: effectiveChat?.id,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        console.log('✅ Auth response:', {
          user: data.user,
          groupsCount: data.groups?.length || 0,
          groups: data.groups?.map((g: any) => g.telegramTitle),
        })
        setUser(data.user)
        setGroups(data.groups || [])

        if (data.groups && data.groups.length > 0) {
          setSelectedGroup(data.groups[0])
          console.log(`📂 Selected group: ${data.groups[0].telegramTitle}`)
        } else {
          console.log('ℹ️ User has no groups yet')
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
      const groupResponse = await fetch(`/api/groups/${selectedGroup.id}`)
      if (groupResponse.ok) {
        const data = await groupResponse.json()
        setGroupMembers(data.members || [])

        setSelectedGroup(prev => prev ? {
          ...prev,
          memberCount: data.group?.memberCount || prev.memberCount
        } : null)
      }

      await loadSlots()
    } catch (error) {
      console.error('Error loading group data:', error)
    }
  }

  const loadSlots = async () => {
    if (!selectedGroup || !user) return

    try {
      console.log('📂 Loading slots for group:', selectedGroup.id, 'user:', user.id)
      const response = await fetch(`/api/slots?groupId=${selectedGroup.id}&userId=${user.id}`)
      if (response.ok) {
        const data = await response.json()
        const slotsWithDates = data.map((slot: any) => ({
          ...slot,
          startAt: slot.startAt ? new Date(slot.startAt) : undefined,
          endAt: slot.endAt ? new Date(slot.endAt) : undefined,
        }))
        setSlots(slotsWithDates)
        console.log(`✅ Loaded ${slotsWithDates.length} slots`)
      } else {
        const errorText = await response.text()
        console.error('❌ Failed to load slots:', response.status, errorText)
      }
    } catch (error) {
      console.error('❌ Failed to load slots:', error)
    }
  }

  // Drag & Drop handlers
  const handleDragStart = (e: React.DragEvent, slot: Slot) => {
    setDraggedSlot(slot)
    setIsDragging(true)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', slot.id)
    triggerHaptic('light') // Haptic feedback on drag start
  }

  const handleDragOver = (e: React.DragEvent, date: Date) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropTargetDate(date)
  }

  const handleDragLeave = () => {
    setDropTargetDate(null)
  }

  const handleDrop = async (e: React.DragEvent, date: Date) => {
    e.preventDefault()
    setDropTargetDate(null)
    setIsDragging(false)

    if (!draggedSlot || !user || !selectedGroup) return

    triggerHaptic('medium') // Haptic feedback on drop

    const dateStr = date.toISOString().split('T')[0]
    const newStart = new Date(`${dateStr}T${draggedSlot.startTimeLocal}:00`)
    const newEnd = new Date(`${dateStr}T${draggedSlot.endTimeLocal}:00`)

    try {
      const response = await fetch(`/api/slots/${draggedSlot.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Не удалось удалить оригинальный слот')
      }

      const createResponse = await fetch('/api/slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          groupId: selectedGroup.id,
          type: 'ONE_TIME',
          description: draggedSlot.description,
          startAt: newStart.toISOString(),
          endAt: newEnd.toISOString(),
          startTimeLocal: draggedSlot.startTimeLocal,
          endTimeLocal: draggedSlot.endTimeLocal,
        }),
      })

      if (!createResponse.ok) {
        throw new Error('Не удалось создать слот на новой дате')
      }

      toast({ title: 'Успешно', description: 'Слот перемещён' })
      triggerHaptic('success') // Haptic feedback on success
      setDraggedSlot(null)
      await loadSlots()
    } catch (error) {
      console.error('❌ Drag & Drop error:', error)
      triggerHaptic('error') // Haptic feedback on error
      toast({ title: 'Ошибка', description: 'Не удалось переместить слот', variant: 'destructive' })
    }
  }

  // Multiple selection handlers
  const handleDateMouseDown = (date: Date, e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      toggleDateSelection(date)
      triggerHaptic('light') // Haptic feedback on selection
      e.preventDefault()
    } else {
      setIsLongPress(false)
      const timer = setTimeout(() => {
        setIsLongPress(true)
        toggleDateSelection(date)
        triggerHaptic('medium') // Haptic feedback on long press selection
      }, 500)
      setLongPressTimer(timer)
    }
  }

  const handleDateMouseUp = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer)
      setLongPressTimer(null)
    }
  }

  const toggleDateSelection = (date: Date) => {
    const dateStr = date.toDateString()
    setSelectedDates(prev => {
      const isRemoving = prev.some(d => d.toDateString() === dateStr)
      if (isRemoving) {
        triggerHaptic('light') // Haptic feedback on deselect
        return prev.filter(d => d.toDateString() !== dateStr)
      }
      triggerHaptic('light') // Haptic feedback on select
      return [...prev, date]
    })
  }

  const handleCreateForSelectedDates = async (slotData: any) => {
    if (!user || !selectedGroup || selectedDates.length === 0) return

    try {
      for (const date of selectedDates) {
        const dateStr = date.toISOString().split('T')[0]
        const startD = new Date(`${dateStr}T${slotData.startTime}:00`)
        const endD = new Date(`${dateStr}T${slotData.endTime}:00`)

        await fetch('/api/slots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            groupId: selectedGroup.id,
            type: 'ONE_TIME',
            description: slotData.description,
            startAt: startD.toISOString(),
            endAt: endD.toISOString(),
            startTimeLocal: slotData.startTime,
            endTimeLocal: slotData.endTime,
          }),
        })
      }

      toast({ title: 'Успешно', description: `Создано ${selectedDates.length} слотов` })
      triggerHaptic('success') // Haptic feedback on success
      setSelectedDates([])
      await loadSlots()
    } catch (error) {
      console.error('❌ Error creating slots for selected dates:', error)
      triggerHaptic('error') // Haptic feedback on error
      toast({ title: 'Ошибка', description: 'Не удалось создать слоты', variant: 'destructive' })
    }
  }

  // Inline Edit handlers
  const handleStartEdit = (slot: Slot) => {
    setEditingSlotId(slot.id)
    setEditingDescription(getCleanDescription(slot.description))
    setEditingStartTime(slot.startTimeLocal || '')
    setEditingEndTime(slot.endTimeLocal || '')
    triggerHaptic('light') // Haptic feedback on edit start
  }

  const handleSaveEdit = async (slot: Slot) => {
    if (!user || !selectedGroup) return

    const categoryPrefix = slotCategories[getSlotCategory(slot.description)].prefix
    const descriptionToSave = editingDescription
      ? (categoryPrefix ? `${categoryPrefix} ${editingDescription}` : editingDescription)
      : categoryPrefix

    try {
      const updateData: any = {
        description: descriptionToSave,
        startTimeLocal: editingStartTime,
        endTimeLocal: editingEndTime,
      }

      if (slot.type === 'ONE_TIME') {
        const dateStr = slot.startAt!.toISOString().split('T')[0]
        const startD = new Date(`${dateStr}T${editingStartTime}:00`)
        const endD = new Date(`${dateStr}T${editingEndTime}:00`)
        updateData.startAt = startD.toISOString()
        updateData.endAt = endD.toISOString()
      } else {
        updateData.dayOfWeek = slot.dayOfWeek
      }

      // First delete old slot
      await fetch(`/api/slots/${slot.id}`, { method: 'DELETE' })

      // Then create new one
      await fetch('/api/slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          groupId: selectedGroup.id,
          type: slot.type,
          ...updateData,
        }),
      })

      toast({ title: 'Успешно', description: 'Обновлено' })
      triggerHaptic('success') // Haptic feedback on save
      setEditingSlotId(null)
      await loadSlots()
    } catch (error) {
      console.error('❌ Error updating slot:', error)
      triggerHaptic('error') // Haptic feedback on error
      toast({ title: 'Ошибка', description: 'Не удалось обновить', variant: 'destructive' })
    }
  }

  const handleCancelEdit = () => {
    setEditingSlotId(null)
    setEditingDescription('')
    setEditingStartTime('')
    setEditingEndTime('')
    triggerHaptic('warning') // Haptic feedback on cancel
  }

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

    console.log('💾 Saving slot with user:', {
      userId: user.id,
      userFirstName: user.firstName,
      groupId: selectedGroup.id,
      groupName: selectedGroup.telegramTitle,
    })

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

      console.log('📝 Description to save:', descriptionToSave)
      console.log('📝 Original description:', description)
      console.log('📝 Clean description:', cleanDesc)
      console.log('📝 Category prefix:', categoryPrefix)

      if (slotType === 'CYCLIC_WEEKLY') {
        const payloads = selectedDays.map(day => ({
          type: 'CYCLIC_WEEKLY',
          description: descriptionToSave,
          dayOfWeek: day,
          startTimeLocal: startTime,
          endTimeLocal: endTime,
        }))

        for (const payload of payloads) {
          console.log('💾 Saving cyclic slot:', payload)
          const response = await fetch('/api/slots', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user.id,
              groupId: selectedGroup.id,
              ...payload,
            }),
          })

          if (!response.ok) {
            const errorText = await response.text()
            const errorData = errorText ? JSON.parse(errorText) : {}
            console.error('❌ Failed to save cyclic slot:', {
              status: response.status,
              statusText: response.statusText,
              error: errorText,
              errorData,
            })
            throw new Error(errorData.error || errorData.details || errorText || 'Failed to save slot')
          }
          const result = await response.json()
          console.log('✅ Cyclic slot saved:', result)
        }
      } else {
        const startD = new Date(`${date}T${startTime}:00`)
        const endD = new Date(`${date}T${endTime}:00`)

        const payload = {
          userId: user.id,
          groupId: selectedGroup.id,
          type: 'ONE_TIME',
          description: descriptionToSave,
          startAt: startD.toISOString(),
          endAt: endD.toISOString(),
          startTimeLocal: startTime,
          endTimeLocal: endTime,
        }

        console.log('💾 Saving one-time slot:', payload)

        const response = await fetch('/api/slots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (!response.ok) {
          const errorText = await response.text()
          const errorData = errorText ? JSON.parse(errorText) : {}
          console.error('❌ Failed to save one-time slot:', {
            status: response.status,
            statusText: response.statusText,
            error: errorText,
            errorData,
          })
          throw new Error(errorData.error || errorData.details || errorText || 'Failed to save slot')
        }

        const result = await response.json()
        console.log('✅ One-time slot saved:', result)
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

  const openDeleteDialog = (slot: Slot) => {
    console.log('📝 Opening delete dialog for slot:', {
      id: slot.id,
      type: slot.type,
      description: slot.description,
      dayOfWeek: slot.dayOfWeek,
      startTimeLocal: slot.startTimeLocal,
      endTimeLocal: slot.endTimeLocal,
    })
    
    const similarSlots = slots.filter(s => s.description === slot.description)
    console.log('🔍 Slots with same description:', similarSlots.map(s => ({
      id: s.id,
      dayOfWeek: s.dayOfWeek,
      startTimeLocal: s.startTimeLocal,
      endTimeLocal: s.endTimeLocal,
    })))
    
    setSlotToDelete(slot)
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async (deleteAllRepetitions: boolean = false) => {
    if (!slotToDelete) return

    console.log('🗑️ Deleting slot:', {
      slotId: slotToDelete.id,
      slotType: slotToDelete.type,
      deleteAllRepetitions,
      description: slotToDelete.description,
      dayOfWeek: slotToDelete.dayOfWeek,
      startTimeLocal: slotToDelete.startTimeLocal,
      endTimeLocal: slotToDelete.endTimeLocal,
    })

    setDeleteLoading(true)

    try {
      if (deleteAllRepetitions && slotToDelete.type === 'CYCLIC_WEEKLY' && slotToDelete.description) {
        // Удалить всю циклическую запись (все дни с одинаковым описанием и временем)
        const allRepetitions = slots.filter(
          s => s.type === 'CYCLIC_WEEKLY'
            && s.description === slotToDelete.description
            && s.startTimeLocal === slotToDelete.startTimeLocal
            && s.endTimeLocal === slotToDelete.endTimeLocal
        )

        console.log(`🗑️ Deleting ${allRepetitions.length} repetitions (all days of week)`)
        console.log('Slots to delete:', allRepetitions.map(s => ({ id: s.id, dayOfWeek: s.dayOfWeek })))

        for (const slot of allRepetitions) {
          const response = await fetch(`/api/slots/${slot.id}`, { method: 'DELETE' })
          if (!response.ok) {
            console.error(`❌ Failed to delete slot ${slot.id}:`, response.status)
          } else {
            console.log(`✅ Deleted slot ${slot.id} (${daysOfWeek[jsDayToDisplayDay(slot.dayOfWeek || 0)]})`)
          }
        }

        toast({
          title: 'Успешно',
          description: `Удалено ${allRepetitions.length} повторений`,
        })
      } else {
        // Удалить только этот конкретный слот (по ID)
        console.log(`🗑️ Deleting single slot: ${slotToDelete.id}`)
        const response = await fetch(`/api/slots/${slotToDelete.id}`, { method: 'DELETE' })

        if (!response.ok) {
          console.error('❌ Failed to delete slot:', response.status)
          throw new Error('Failed to delete slot')
        }

        console.log('✅ Slot deleted successfully')

        if (slotToDelete.type === 'CYCLIC_WEEKLY') {
          const dayName = daysOfWeek[jsDayToDisplayDay(slotToDelete.dayOfWeek || 0)]
          toast({
            title: 'Успешно',
            description: `Удалено на ${dayName}`,
          })
        } else {
          const dateStr = slotToDelete.startAt
            ? new Date(slotToDelete.startAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
            : ''
          toast({
            title: 'Успешно',
            description: dateStr ? `Удалено на ${dateStr}` : 'Время удалено',
          })
        }
      }

      setDeleteDialogOpen(false)
      setSlotToDelete(null)
      await loadSlots()
    } catch (error) {
      console.error('❌ Delete error:', error)
      toast({ title: 'Ошибка', description: 'Не удалось удалить', variant: 'destructive' })
    } finally {
      setDeleteLoading(false)
    }
  }

  const getDayBusyness = (date: Date) => {
    const daySlots = getSlotsForDate(date)
    if (daySlots.length === 0) return 0

    let totalBusyMinutes = 0
    daySlots.forEach(slot => {
      if (slot.startTimeLocal && slot.endTimeLocal) {
        const [sh, sm] = slot.startTimeLocal.split(':').map(Number)
        const [eh, em] = slot.endTimeLocal.split(':').map(Number)
        const minutes = (eh * 60 + em) - (sh * 60 + sm)
        totalBusyMinutes += Math.max(0, minutes)
      }
    })

    return Math.min(100, (totalBusyMinutes / 1440) * 100)
  }

  const renderGanttBars = (date: Date) => {
    const daySlots = getSlotsForDate(date)
    if (daySlots.length === 0) return null

    const busyness = getDayBusyness(date)

    let barColor = 'bg-green-500'
    if (busyness > 30) barColor = 'bg-yellow-500'
    if (busyness > 60) barColor = 'bg-orange-500'
    if (busyness > 80) barColor = 'bg-red-500'

    return (
      <div className="absolute bottom-0 left-0 right-0 h-1.5 flex gap-0.5 px-0.5 pb-0.5">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${busyness}%` }}
        />
      </div>
    )
  }

  const toggleDay = (day: number) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    )
  }

  const handleFindCommonTime = async () => {
    if (!selectedGroup) {
      toast({ title: 'Ошибка', description: 'Выберите группу', variant: 'destructive' })
      return
    }

    setSearching(true)
    setSearchResults(null)

    try {
      const response = await fetch('/api/find-time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId: selectedGroup.id,
          daysToLookAhead: 7,
          minDuration: 30,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setSearchResults(data.slots || [])
        toast({
          title: 'Поиск завершен',
          description: `Найдено ${data.count} свободных слотов`,
        })
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

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) {
      return mins > 0 ? `${hours}ч ${mins}м` : `${hours}ч`
    }
    return `${mins}м`
  }

  // Render Month View Calendar
  const renderMonthCalendar = () => {
    const year = selectedDate.getFullYear()
    const month = selectedDate.getMonth()
    const firstDay = (new Date(year, month, 1).getDay() + 6) % 7
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const today = new Date()

    const days = []

    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-8 sm:h-11"></div>)
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day)
      const isToday = date.toDateString() === today.toDateString()
      const isSelected = date.toDateString() === selectedDate.toDateString()
      const isMultiSelected = selectedDates.some(d => d.toDateString() === date.toDateString())
      const isDropTarget = dropTargetDate?.toDateString() === date.toDateString()
      const busyness = getDayBusyness(date)
      const hasSlots = busyness > 0
      const daySlots = getSlotsForDate(date)

      days.push(
        <button
          key={day}
          draggable={hasSlots && filteredSlots.some(s => s.id === daySlots[0]?.id)}
          onDragStart={(e) => hasSlots && daySlots[0] && handleDragStart(e, daySlots[0])}
          onMouseDown={(e) => handleDateMouseDown(date, e)}
          onMouseUp={handleDateMouseUp}
          onMouseEnter={() => {
            if (daySlots.length > 0) {
              setHoveredDate(date)
              setShowQuickView(true)
            }
          }}
          onMouseLeave={() => {
            setHoveredDate(null)
            setShowQuickView(false)
          }}
          onDragOver={(e) => handleDragOver(e, date)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, date)}
          className={`h-8 sm:h-11 w-full rounded-lg sm:rounded-xl flex items-center justify-center text-[11px] sm:text-sm font-medium transition-all relative overflow-hidden
            ${isDragging && isDropTarget ? 'ring-2 ring-dashed ring-blue-400 bg-blue-50' : ''}
            ${isSelected ? 'bg-blue-500 text-white shadow-sm' : ''}
            ${!isSelected && isMultiSelected ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-300' : ''}
            ${!isSelected && !isMultiSelected && hasSlots ? 'bg-gray-50 hover:bg-gray-100' : ''}
            ${!isSelected && !isMultiSelected && !hasSlots ? 'text-gray-600 hover:bg-gray-50' : ''}
            ${isToday && !isSelected && !isMultiSelected ? 'ring-2 ring-blue-400' : ''}
          `}
        >
          <span className="relative z-10">{day}</span>
          {renderGanttBars(date)}
          {isMultiSelected && (
            <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
          )}
        </button>
      )
    }

    return days
  }

  // Render Week View
  const renderWeekView = () => {
    const weekStart = new Date(selectedDate)
    const dayOfWeek = weekStart.getDay()
    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    weekStart.setDate(weekStart.getDate() - diff)

    const weekDays = []
    const timeSlots = []
    
    // Generate time slots from 6:00 to 23:00
    for (let hour = 6; hour <= 23; hour++) {
      timeSlots.push(`${hour.toString().padStart(2, '0')}:00`)
    }

    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart)
      date.setDate(date.getDate() + i)
      weekDays.push(date)
    }

    const today = new Date()
    const currentTimePosition = getCurrentTimePosition()

    return (
      <div className="space-y-2">
        {/* Week header */}
        <div className="grid grid-cols-8 gap-1 text-xs font-semibold text-gray-500">
          <div className="text-center py-2"></div>
          {weekDays.map((date, i) => {
            const isToday = date.toDateString() === today.toDateString()
            return (
              <div 
                key={i}
                className={`text-center py-2 rounded-lg cursor-pointer transition-colors
                  ${isToday ? 'bg-blue-500 text-white shadow-sm' : 'hover:bg-gray-50'}
                `}
                onClick={() => {
                  setSelectedDate(date)
                  triggerHaptic('light') // Haptic feedback on day select
                }}
              >
                <div className="text-xs opacity-70">{daysOfWeek[i]}</div>
                <div className={`font-bold ${isToday ? '' : ''}`}>
                  {date.getDate()}
                </div>
              </div>
            )
          })}
        </div>

        {/* Current time indicator - Modern design with gradient */}
        {currentTimePosition !== null && (
          <div className="relative w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent rounded-full overflow-hidden">
            <div className="absolute inset-0 bg-blue-500 animate-pulse" />
            <div 
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-blue-500 rounded-full shadow-lg shadow-blue-500/50 ring-2 ring-white transition-all"
              style={{ left: `${currentTimePosition}%` }}
            >
              <div className="absolute inset-0 bg-blue-400 rounded-full animate-ping" />
            </div>
          </div>
        )}

        {/* Time grid with smooth scroll snap */}
        <div 
          className="space-y-1 max-h-[500px] overflow-y-auto snap-y snap-mandatory scroll-smooth custom-scrollbar"
        >
          {timeSlots.map(time => (
            <div key={time} className="grid grid-cols-8 gap-1 snap-start">
              <div className="text-xs text-gray-400 text-right pr-2 py-2 font-mono sticky left-0 bg-white/80 backdrop-blur-sm">
                {time}
              </div>
              {weekDays.map((date, dayIndex) => {
                const daySlots = getSlotsForDate(date)
                const [hour] = time.split(':').map(Number)
                
                // Find slots that cover this hour
                const slotsInHour = daySlots.filter(slot => {
                  if (!slot.startTimeLocal) return false
                  const [startHour] = slot.startTimeLocal.split(':').map(Number)
                  return startHour === hour
                })

                const isSelected = selectedDate.toDateString() === date.toDateString()
                const isToday = date.toDateString() === today.toDateString()
                const now = new Date()
                const isCurrentHour = isToday && now.getHours() === hour
                
                return (
                  <div 
                    key={dayIndex}
                    onClick={() => {
                      setSelectedDate(date)
                      triggerHaptic('light') // Haptic feedback on time slot click
                    }}
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.dataTransfer.dropEffect = 'move'
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      if (draggedSlot) {
                        const dateStr = date.toISOString().split('T')[0]
                        const newStart = new Date(`${dateStr}T${draggedSlot.startTimeLocal}:00`)
                        const newEnd = new Date(`${dateStr}T${draggedSlot.endTimeLocal}:00`)
                        
                        // Create a temporary event to reuse handleDrop logic
                        const syntheticEvent = e as React.DragEvent
                        handleDrop(syntheticEvent, date)
                      }
                    }}
                    className={`min-h-[40px] rounded-xl border-2 border-dashed p-1.5 transition-all relative overflow-hidden
                      ${isCurrentHour ? 'border-blue-400 bg-blue-50/50 ring-2 ring-blue-200' : 'border-gray-200'}
                      ${isSelected ? 'ring-2 ring-blue-400 bg-blue-50/80' : 'hover:border-blue-300 hover:bg-gray-50/50'}
                      ${isDragging ? 'opacity-50' : ''}
                    `}
                  >
                    {isCurrentHour && (
                      <div className="absolute top-0 right-0 w-2 h-2 bg-blue-500 rounded-full animate-ping" />
                    )}
                    <div className="space-y-1.5">
                      {slotsInHour.map(slot => {
                        const category = getSlotCategory(slot.description)
                        const categoryData = slotCategories[category]
                        const Icon = categoryData.icon
                        const cleanDesc = getCleanDescription(slot.description)

                        return (
                          <div
                            key={slot.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, slot)}
                            className={`p-2 rounded-xl text-xs font-medium ${categoryData.bgColor} ${categoryData.textColor} ${categoryData.borderColor} border flex items-center gap-2 cursor-grab active:cursor-grabbing transition-all hover:scale-105 hover:shadow-md ${categoryData.shadowColor}`}
                          >
                            <GripVertical className="w-3.5 h-3.5 opacity-40 flex-shrink-0" />
                            <Icon className="w-4 h-4 flex-shrink-0" />
                            <span className="truncate flex-1">{cleanDesc || 'Без названия'}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    )
  }

  const filteredSlots = getFilteredSlots(selectedDate)

  if (initializing) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-600">Загрузка...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="w-full max-w-5xl mx-auto px-3 sm:px-4 pb-32">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1 sm:mb-2">
                📅 TimeAgree
              </h1>
              <p className="text-sm sm:text-base text-gray-600">
                {user ? `Привет, ${user.firstName}!` : 'Загрузка...'}
              </p>
            </div>
          </div>
        </div>

        {/* Group Selector */}
        {groups.length > 0 && (
          <Card className="mb-6 bg-white border border-gray-200 shadow-sm">
            <CardContent className="p-4">
              <div className="relative">
                <button
                  onClick={() => setGroupMenuOpen(!groupMenuOpen)}
                  className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold">
                      {selectedGroup?.telegramTitle?.[0] || 'G'}
                    </div>
                    <div className="text-left">
                      <div className="font-semibold text-gray-900">{selectedGroup?.telegramTitle}</div>
                      <div className="text-xs text-gray-500">{getParticipantsText(selectedGroup?.memberCount || 0)}</div>
                    </div>
                  </div>
                  <ChevronDown className={`w-5 h-5 text-gray-400 transition ${groupMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {groupMenuOpen && (
                  <>
                    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40" onClick={() => setGroupMenuOpen(false)} />
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden">
                      {groups.map(group => (
                        <button
                          key={group.id}
                          onClick={() => {
                            setSelectedGroup(group)
                            setGroupMenuOpen(false)
                          }}
                          className={`w-full p-3 flex items-center gap-3 hover:bg-gray-50 transition-all ${
                            selectedGroup?.id === group.id ? 'bg-blue-50' : ''
                          }`}
                        >
                          <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold">
                            {group.telegramTitle[0]}
                          </div>
                          <div className="text-left flex-1">
                            <div className="font-semibold text-gray-900">{group.telegramTitle}</div>
                            <div className="text-xs text-gray-500">{getParticipantsText(group.memberCount)}</div>
                          </div>
                          {selectedGroup?.id === group.id && (
                            <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                              <div className="w-2 h-2 bg-white rounded-full"></div>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 h-auto gap-1 p-1 bg-gray-100 border border-gray-200">
            <TabsTrigger value="slots" className="flex items-center justify-center gap-1.5 py-2.5 px-2 sm:px-3 data-[state=active]:bg-white data-[state=active]:shadow-sm text-xs sm:text-sm">
              <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
              <span className="font-medium">Моё время</span>
            </TabsTrigger>
            <TabsTrigger value="find" className="flex items-center justify-center gap-1.5 py-2.5 px-2 sm:px-3 data-[state=active]:bg-white data-[state=active]:shadow-sm text-xs sm:text-sm">
              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
              <span className="font-medium">Найти время</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center justify-center gap-1.5 py-2.5 px-2 sm:px-3 data-[state=active]:bg-white data-[state=active]:shadow-sm text-xs sm:text-sm">
              <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
              <span className="font-medium">Настройки</span>
            </TabsTrigger>
          </TabsList>

          {/* My Slots Tab */}
          <TabsContent value="slots" className="space-y-4">
            <Card className="bg-white border border-gray-200 shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <CardTitle className="text-lg sm:text-xl font-semibold text-gray-900">
                    Календарь
                  </CardTitle>
                  <div className="flex items-center gap-1 sm:gap-2 w-full sm:w-auto">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 sm:h-9 sm:w-9 flex-shrink-0 hover:bg-blue-50 hover:text-blue-600 transition-colors flex-shrink-0"
                      onClick={() => {
                        const newDate = new Date(selectedDate)
                        newDate.setMonth(newDate.getMonth() - 1)
                        setSelectedDate(newDate)
                      }}
                    >
                      <span className="text-base sm:text-lg font-bold">←</span>
                    </Button>
                    <span className="text-xs sm:text-sm font-semibold px-2 whitespace-nowrap text-gray-700 flex-1 sm:flex-none text-center">
                      {selectedDate.toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' })}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 sm:h-9 sm:w-9 flex-shrink-0 hover:bg-blue-50 hover:text-blue-600 transition-colors flex-shrink-0"
                      onClick={() => {
                        const newDate = new Date(selectedDate)
                        newDate.setMonth(newDate.getMonth() + 1)
                        setSelectedDate(newDate)
                      }}
                    >
                      <span className="text-base sm:text-lg font-bold">→</span>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="grid grid-cols-7 mb-2">
                  {daysOfWeek.map(day => (
                    <div key={day} className="text-center text-[10px] sm:text-xs font-semibold text-gray-500 py-1.5 sm:py-2">
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-0.5 sm:gap-1.5">
                  {renderMonthCalendar()}
                </div>
              </CardContent>
            </Card>

            {/* Quick View Popup with glassmorphism */}
            {showQuickView && hoveredDate && (
              <div
                ref={quickViewRef}
                className="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-4 w-72 animate-in fade-in slide-in-from-top-2 duration-200"
                style={{
                  left: '50%',
                  transform: 'translateX(-50%)',
                  top: '30%',
                }}
              >
                <div className="font-semibold text-sm mb-3 text-gray-900 flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-blue-500" />
                  {hoveredDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                  {getSlotsForDate(hoveredDate).map(slot => {
                    const category = getSlotCategory(slot.description)
                    const categoryData = slotCategories[category]
                    const Icon = categoryData.icon
                    const cleanDesc = getCleanDescription(slot.description)

                    return (
                      <div
                        key={slot.id}
                        className={`flex items-start gap-2 p-2.5 rounded-xl ${categoryData.bgColor} ${categoryData.borderColor} border transition-transform hover:scale-102 cursor-pointer`}
                      >
                        <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${categoryData.textColor}`} />
                        <div className="flex-1 min-w-0">
                          <div className={`text-xs font-semibold ${categoryData.textColor} truncate`}>
                            {cleanDesc || (slot.type === 'CYCLIC_WEEKLY' ? 'Каждую неделю (циклический)' : 'Разово')}
                          </div>
                          <div className="text-xs text-gray-500 font-mono">
                            {slot.startTimeLocal} - {slot.endTimeLocal}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  {getSlotsForDate(hoveredDate).length === 0 && (
                    <div className="text-center text-sm text-gray-500 py-4">
                      ✨ В этот день вы свободны
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Found Slots Widget */}
            {searchResults && searchResults.length > 0 && (
              <Card className="bg-green-50 border border-green-200 shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base sm:text-lg font-semibold text-green-900 flex items-center gap-2">
                      <Users className="w-4 h-4 sm:w-5 sm:h-5" />
                      Найденные слоты ({searchResults.length})
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSearchResults(null)}
                      className="text-green-700 hover:text-green-900 hover:bg-green-100 h-8 w-8 p-0"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                    {searchResults.slice(0, 3).map((result: any, index: number) => (
                      <div
                        key={index}
                        className="p-3 bg-white border border-green-200 rounded-lg hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-green-900">
                              {new Date(result.startTime).toLocaleDateString('ru-RU', {
                                weekday: 'short',
                                day: 'numeric',
                                month: 'short'
                              })}
                            </div>
                            <div className="text-xs text-green-700 font-mono">
                              {new Date(result.startTime).toLocaleTimeString('ru-RU', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })} - {new Date(result.endTime).toLocaleTimeString('ru-RU', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0 ml-2">
                            <div className="text-sm font-bold text-green-600">
                              {formatDuration(result.duration)}
                            </div>
                            <div className="text-xs text-green-600/70">
                              {result.participants?.length || 0} уч.
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {searchResults.length > 3 && (
                      <p className="text-xs text-center text-green-700 pt-2">
                        Показано 3 из {searchResults.length} найденных слотов
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="bg-white border border-gray-200 shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                  <CardTitle className="text-base sm:text-lg font-semibold">
                    Занятость на {selectedDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
                  </CardTitle>
                  <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                      <Button
                        size="sm"
                        className="gap-2 h-9 sm:h-10 px-3 sm:px-4 bg-blue-500 hover:bg-blue-600 shadow-sm transition-all w-full sm:w-auto"
                      >
                        <Plus className="w-4 h-4 flex-shrink-0" />
                        <span className="text-xs sm:text-sm font-medium">Добавить</span>
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px] bg-white max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle className="text-lg sm:text-xl font-semibold">Добавить занятое время</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div>
                          <Label className="text-sm font-medium text-gray-700">Категория</Label>
                          <div className="grid grid-cols-5 gap-1 sm:gap-2 mt-2">
                            {(Object.keys(slotCategories) as SlotCategory[]).map((cat) => {
                              const catData = slotCategories[cat]
                              const Icon = catData.icon
                              return (
                                <button
                                  key={cat}
                                  onClick={() => setSlotCategory(cat)}
                                  className={`flex flex-col items-center gap-1 sm:gap-1.5 p-1.5 sm:p-2.5 rounded-lg border-2 transition-all ${
                                    slotCategory === cat
                                      ? `${catData.bgColor} ${catData.textColor} ${catData.borderColor} border`
                                      : 'bg-white border-gray-200 hover:border-gray-300'
                                  }`}
                                >
                                  <Icon className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                                  <span className="text-[10px] sm:text-xs font-medium">{catData.label}</span>
                                </button>
                              )
                            })}
                          </div>
                        </div>

                        <div>
                          <Label className="text-sm font-medium text-gray-700">Описание</Label>
                          <Input
                            placeholder="Например: Работа, Встреча"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="mt-2 text-sm"
                          />
                        </div>

                        <div>
                          <Label className="text-sm font-medium text-gray-700">Быстрые шаблоны</Label>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2 mt-2">
                            {quickTemplates.map((template) => {
                              const Icon = template.icon
                              const isActive = slotCategory === template.category &&
                                              startTime === template.startTime &&
                                              endTime === template.endTime
                              return (
                                <button
                                  key={template.name}
                                  onClick={() => applyTemplate(template)}
                                  className={`flex flex-col items-center gap-1 sm:gap-1.5 p-1.5 sm:p-2.5 rounded-xl border-2 transition-all hover:scale-105 ${
                                    isActive
                                      ? 'bg-blue-50 border-blue-400 shadow-md shadow-blue-500/20'
                                      : 'bg-white border-gray-200 hover:border-gray-300'
                                  }`}
                                  title={`${template.name}: ${template.startTime} - ${template.endTime}`}
                                >
                                  <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isActive ? 'text-blue-600' : 'text-gray-500'}`} />
                                  <span className="text-[10px] sm:text-xs font-medium text-gray-600">{template.name}</span>
                                </button>
                              )
                            })}
                          </div>
                        </div>

                        <div>
                          <Label className="text-sm font-medium text-gray-700">Тип</Label>
                          <Select value={slotType} onValueChange={(v: SlotType) => setSlotType(v)}>
                            <SelectTrigger className="mt-2 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ONE_TIME">Одноразово</SelectItem>
                              <SelectItem value="CYCLIC_WEEKLY">Каждую неделю (циклический)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {slotType === 'ONE_TIME' ? (
                          <div>
                            <Label className="text-sm font-medium text-gray-700">Дата</Label>
                            <Input
                              type="date"
                              value={date}
                              onChange={(e) => setDate(e.target.value)}
                              className="mt-2 text-sm"
                            />
                          </div>
                        ) : (
                          <div>
                            <Label className="mb-2 block text-sm font-medium text-gray-700">Дни недели</Label>
                            <div className="flex gap-1">
                              {[1, 2, 3, 4, 5, 6, 0].map(jsDay => (
                                <button
                                  key={jsDay}
                                  onClick={() => toggleDay(jsDay)}
                                  className={`flex-1 py-2 text-[10px] sm:text-xs font-bold rounded-lg transition-all border-2
                                    ${selectedDays.includes(jsDay)
                                      ? 'bg-blue-500 border-blue-500 text-white'
                                      : 'bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200'
                                    }
                                  `}
                                >
                                  {daysOfWeek[jsDayToDisplayDay(jsDay)]}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-sm font-medium text-gray-700">С</Label>
                            <Input
                              type="time"
                              value={startTime}
                              onChange={(e) => setStartTime(e.target.value)}
                              className="mt-2 text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-sm font-medium text-gray-700">До</Label>
                            <Input
                              type="time"
                              value={endTime}
                              onChange={(e) => setEndTime(e.target.value)}
                              className="mt-2 text-sm"
                            />
                          </div>
                        </div>

                        {selectedDates.length > 0 && (
                          <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs sm:text-sm font-medium text-blue-900">
                                Также создать для {selectedDates.length} выбранных дней
                              </span>
                              <div className="flex gap-2 flex-shrink-0">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const slotData = { description, startTime, endTime }
                                    handleCreateForSelectedDates(slotData)
                                  }}
                                  className="bg-blue-500 text-white hover:bg-blue-600 border-blue-500 text-xs sm:text-sm"
                                >
                                  <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" />
                                  Да
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSelectedDates([])}
                                  className="text-blue-600 h-8 w-8 p-0"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}

                        <Button
                          onClick={handleSaveSlot}
                          disabled={savingSlot}
                          className="w-full bg-blue-500 hover:bg-blue-600 shadow-sm transition-all"
                        >
                          {savingSlot ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Сохранение...
                            </>
                          ) : (
                            <>
                              <Zap className="w-4 h-4 mr-2" />
                              Сохранить
                            </>
                          )}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {/* Search and Filter */}
                <div className="space-y-3 mb-4">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        placeholder="Поиск по описанию..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 text-sm"
                      />
                    </div>
                    <Select value={filterCategory} onValueChange={(v: SlotCategory | 'all') => setFilterCategory(v)}>
                      <SelectTrigger className="w-full sm:w-[140px]">
                        <Filter className="w-4 h-4 mr-2 text-gray-400" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Все</SelectItem>
                        {(Object.keys(slotCategories) as SlotCategory[]).map(cat => (
                          <SelectItem key={cat} value={cat}>{slotCategories[cat].label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
              <CardContent>
                {filteredSlots.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    {searchQuery || filterCategory !== 'all' ? (
                      <div>
                        <Search className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p>Ничего не найдено 🔍</p>
                      </div>
                    ) : (
                      <div>
                        <CalendarDays className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p>В этот день вы свободны ✨</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredSlots.map(slot => {
                      const isCyclic = slot.type === 'CYCLIC_WEEKLY'
                      const category = getSlotCategory(slot.description)
                      const categoryData = slotCategories[category]
                      const Icon = categoryData.icon
                      const cleanDesc = getCleanDescription(slot.description)
                      const isEditing = editingSlotId === slot.id
                      const relatedCyclicCount = isCyclic && slot.description
                        ? slots.filter(s =>
                            s.type === 'CYCLIC_WEEKLY' &&
                            s.description === slot.description
                          ).length
                        : 0

                      return (
                        <div
                          key={slot.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, slot)}
                          className={`flex items-center justify-between p-3 sm:p-4 rounded-xl border-2 ${categoryData.bgColor} ${categoryData.borderColor} transition-all hover:scale-[1.01] hover:shadow-lg ${categoryData.shadowColor} ${isDragging ? 'opacity-50' : ''}`}
                        >
                          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                            <div className={`p-2 sm:p-2.5 rounded-xl ${categoryData.bgColor} ${categoryData.borderColor} border flex-shrink-0`}>
                              <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${categoryData.textColor}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              {isEditing ? (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <Input
                                      value={editingDescription}
                                      onChange={(e) => setEditingDescription(e.target.value)}
                                      className="h-8 text-sm flex-1 text-xs"
                                      autoFocus
                                      placeholder="Описание"
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault()
                                        }
                                      }}
                                    />
                                  </div>
                                  <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                                    <Input
                                      type="time"
                                      value={editingStartTime}
                                      onChange={(e) => setEditingStartTime(e.target.value)}
                                      className="h-8 text-sm w-24 sm:w-28 text-xs"
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault()
                                        }
                                      }}
                                    />
                                    <span className="text-xs text-gray-500">—</span>
                                    <Input
                                      type="time"
                                      value={editingEndTime}
                                      onChange={(e) => setEditingEndTime(e.target.value)}
                                      className="h-8 text-sm w-24 sm:w-28 text-xs"
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          handleSaveEdit(slot)
                                        } else if (e.key === 'Escape') {
                                          handleCancelEdit()
                                        }
                                      }}
                                    />
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleSaveEdit(slot)}
                                      className="h-8 w-8 p-0 text-green-600 hover:bg-green-50 flex-shrink-0"
                                    >
                                      <Check className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={handleCancelEdit}
                                      className="h-8 w-8 p-0 text-red-600 hover:bg-red-50 flex-shrink-0"
                                    >
                                      <X className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div
                                    className={`font-semibold text-xs sm:text-sm ${categoryData.textColor} cursor-pointer hover:underline flex items-center gap-1 sm:gap-2`}
                                    onClick={() => handleStartEdit(slot)}
                                  >
                                    {cleanDesc || (isCyclic ? 'Каждую неделю (циклический)' : 'Разово')}
                                    <Edit3 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    {isCyclic && relatedCyclicCount > 1 && (
                                      <span className={`ml-0 sm:ml-2 text-xs px-1.5 sm:px-2 py-0.5 rounded-full ${categoryData.bgColor} ${categoryData.borderColor} border`}>
                                        {relatedCyclicCount} дн.
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-gray-500 font-mono">
                                    {slot.startTimeLocal} - {slot.endTimeLocal}
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                            <GripVertical className="w-4 h-4 sm:w-5 sm:h-5 text-gray-300 cursor-grab active:cursor-grabbing mr-1 sm:mr-2" />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openCopyDialog(slot)}
                              className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 h-8 w-8 sm:h-9 sm:w-9 p-0"
                              title="Копировать"
                            >
                              <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openDeleteDialog(slot)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8 sm:h-9 sm:w-9 p-0"
                            >
                              <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>


          </TabsContent>

          {/* Find Time Tab */}
          <TabsContent value="find">
            <Card className="bg-white border border-gray-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-gray-900">
                  Найти общее свободное время
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!searchResults && !searching && (
                  <div className="text-center py-16">
                    <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Users className="w-10 h-10 text-blue-500" />
                    </div>
                    <p className="text-gray-600 mb-2 font-medium">
                      Найдите общее свободное время с участниками группы
                    </p>
                    <p className="text-sm text-gray-500 mb-6">
                      Группа: {selectedGroup?.telegramTitle}
                    </p>
                    <Button
                      onClick={handleFindCommonTime}
                      className="gap-2 bg-blue-500 hover:bg-blue-600 shadow-sm"
                      size="lg"
                    >
                      <Search className="w-5 h-5" />
                      Найти свободное время
                    </Button>
                  </div>
                )}

                {searching && (
                  <div className="text-center py-16">
                    <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-blue-500" />
                    <p className="text-gray-600 font-medium">Ищем пересечения...</p>
                  </div>
                )}

                {searchResults && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-6">
                      <p className="text-sm text-gray-600">
                        Найдено {searchResults.length} свободных слотов на ближайшие 7 дней
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSearchResults(null)
                        }}
                      >
                        Новый поиск
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {searchResults.map((result: any, index: number) => (
                        <div
                          key={index}
                          className="p-4 bg-green-50 border-2 border-green-200 rounded-lg hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-semibold text-green-900">
                                {new Date(result.startTime).toLocaleDateString('ru-RU', { 
                                  weekday: 'short', 
                                  day: 'numeric', 
                                  month: 'short' 
                                })}
                              </div>
                              <div className="text-sm text-green-700 font-mono">
                                {new Date(result.startTime).toLocaleTimeString('ru-RU', { 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                })} - {new Date(result.endTime).toLocaleTimeString('ru-RU', { 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                })}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-bold text-green-600">
                                {formatDuration(result.duration)}
                              </div>
                              <div className="text-xs text-green-600/70">
                                {result.participants?.length || 0} участника
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <Card className="bg-white border border-gray-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-gray-900">
                  Настройки
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-blue-500" />
                    Группы
                  </h3>
                  <div className="space-y-2">
                    {groups.map(group => (
                      <div
                        key={group.id}
                        className={`p-3 rounded-xl border-2 transition-all ${
                          selectedGroup?.id === group.id
                            ? 'bg-blue-50 border-blue-400'
                            : 'bg-white border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold">
                              {group.telegramTitle[0]}
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900">{group.telegramTitle}</div>
                              <div className="text-xs text-gray-500">{getParticipantsText(group.memberCount)}</div>
                            </div>
                          </div>
                          {selectedGroup?.id === group.id && (
                            <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                              <Check className="w-4 h-4 text-white" />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-6 border-t border-gray-200">
                  <a
                    href="https://t.me/TimeAgreeBot?startgroup=true"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <Button className="w-full gap-2 bg-blue-500 hover:bg-blue-600 shadow-sm">
                      <Plus className="w-4 h-4" />
                      Добавить бота в группу
                    </Button>
                  </a>
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    После добавления отправьте <kbd className="px-2 py-0.5 bg-gray-100 rounded">/start</kbd> в группе
                  </p>
                </div>

                <div className="pt-6 border-t border-gray-200">
                  <Button
                    variant="outline"
                    className="w-full gap-2 text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={() => {
                      localStorage.clear()
                      window.location.reload()
                    }}
                  >
                    <LogOut className="w-4 h-4" />
                    Выйти
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Copy Dialog */}
        <Dialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
          <DialogContent className="sm:max-w-[400px] bg-white">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">Копировать слот</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {slotToCopy && (
                <div className="p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-gray-500" />
                    <span className="font-medium text-gray-900">
                      {getCleanDescription(slotToCopy.description) || 'Без названия'}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 font-mono">
                    {slotToCopy.startTimeLocal} - {slotToCopy.endTimeLocal}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <label className="flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="radio"
                    name="copyMode"
                    checked={!copyAllWeek}
                    onChange={() => setCopyAllWeek(false)}
                    className="w-4 h-4 text-blue-500"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">На конкретную дату</div>
                    <div className="text-xs text-gray-500">Выберите дату для копирования</div>
                  </div>
                </label>

                {!copyAllWeek && (
                  <div className="ml-7">
                    <Input
                      type="date"
                      value={copyDate}
                      onChange={(e) => setCopyDate(e.target.value)}
                    />
                  </div>
                )}

                <label className="flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="radio"
                    name="copyMode"
                    checked={copyAllWeek}
                    onChange={() => setCopyAllWeek(true)}
                    className="w-4 h-4 text-blue-500"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">На все рабочие дни</div>
                    <div className="text-xs text-gray-500">Пн-Пт с тем же временем</div>
                  </div>
                </label>
              </div>

              <Button
                onClick={handleCopySlot}
                className="w-full bg-blue-500 hover:bg-blue-600 shadow-sm"
              >
                Копировать
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent className="sm:max-w-[400px] bg-white">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">Удалить слот</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {slotToDelete && (
                <div className="p-3 bg-red-50 rounded-xl border-2 border-red-200">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-red-500" />
                    <span className="font-medium text-red-900">
                      {getCleanDescription(slotToDelete.description) || 'Без названия'}
                    </span>
                  </div>
                  <div className="text-sm text-red-700 font-mono">
                    {slotToDelete.startTimeLocal} - {slotToDelete.endTimeLocal}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {slotToDelete?.type === 'CYCLIC_WEEKLY' && (
                  <Button
                    onClick={() => handleConfirmDelete(true)}
                    disabled={deleteLoading}
                    variant="destructive"
                    className="w-full"
                  >
                    {deleteLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Удаление...
                      </>
                    ) : (
                      'Удалить все повторения'
                    )}
                  </Button>
                )}
                <Button
                  onClick={() => handleConfirmDelete(false)}
                  disabled={deleteLoading}
                  variant="outline"
                  className="w-full"
                >
                  {deleteLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Удаление...
                    </>
                  ) : (
                    slotToDelete?.type === 'CYCLIC_WEEKLY' 
                      ? `Удалить только ${daysOfWeek[jsDayToDisplayDay(slotToDelete.dayOfWeek || 0)]}`
                      : 'Удалить'
                  )}
                </Button>
                <Button
                  onClick={() => setDeleteDialogOpen(false)}
                  variant="ghost"
                  className="w-full"
                  disabled={deleteLoading}
                >
                  Отмена
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
