'use client'

import { useState, useEffect } from 'react'
import { Calendar, Clock, Settings, Plus, LogOut, Search, Users, User, ChevronDown, Loader2, Copy, Building2, BookOpen, Dumbbell, Gamepad2 } from 'lucide-react'
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

// Slot categories with colors and icons
const slotCategories: Record<SlotCategory, { label: string; icon: any; bgColor: string; textColor: string; borderColor: string; prefix: string }> = {
  work: { label: 'Работа', icon: Building2, bgColor: 'bg-blue-50', textColor: 'text-blue-700', borderColor: 'border-blue-200', prefix: '🏢' },
  study: { label: 'Учёба', icon: BookOpen, bgColor: 'bg-green-50', textColor: 'text-green-700', borderColor: 'border-green-200', prefix: '📚' },
  sport: { label: 'Спорт', icon: Dumbbell, bgColor: 'bg-orange-50', textColor: 'text-orange-700', borderColor: 'border-orange-200', prefix: '🏃' },
  leisure: { label: 'Отдых', icon: Gamepad2, bgColor: 'bg-purple-50', textColor: 'text-purple-700', borderColor: 'border-purple-200', prefix: '🎮' },
  other: { label: 'Другое', icon: Clock, bgColor: 'bg-gray-50', textColor: 'text-gray-700', borderColor: 'border-gray-200', prefix: '' },
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

  const daysOfWeek = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

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
    // Remove emojis and special characters, keep only letters, digits, spaces and basic punctuation
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

  const initializeApp = async () => {
    console.log('🚀 App initialization started...')

    try {
      // Wait a moment for Telegram WebApp SDK to load
      await new Promise(resolve => setTimeout(resolve, 100))

      // Try to get Telegram WebApp user data
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

      // If Telegram.WebApp is not available, try to parse from URL hash
      if (!tgUser && window.location.hash.includes('tgWebAppData')) {
        try {
          const hash = window.location.hash

          // Extract tgWebAppData value (everything after tgWebAppData= until & or end)
          const tgWebAppDataMatch = hash.match(/tgWebAppData=([^&]*)/)
          if (tgWebAppDataMatch && tgWebAppDataMatch[1]) {
            const webAppData = tgWebAppDataMatch[1]

            // Decode and parse the URL-encoded data
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
        // Demo mode: create demo user and group
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

        // Create demo group
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
        // Real Telegram user
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
      // Get chat ID if app is opened from a group
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
          chatId: effectiveChat?.id, // Send chat ID if opened from group
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

        // Select first group or create personal one
        if (data.groups && data.groups.length > 0) {
          setSelectedGroup(data.groups[0])
          console.log(`📂 Selected group: ${data.groups[0].telegramTitle}`)
        } else {
          // Create personal group if user has no groups
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
      // Load group details with members
      const groupResponse = await fetch(`/api/groups/${selectedGroup.id}`)
      if (groupResponse.ok) {
        const data = await groupResponse.json()
        setGroupMembers(data.members || [])

        // Update selectedGroup with fresh memberCount from API
        setSelectedGroup(prev => prev ? {
          ...prev,
          memberCount: data.group?.memberCount || prev.memberCount
        } : null)
      }

      // Load slots for group
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

  const handleSaveSlot = async () => {
    if (!selectedGroup || !user) {
      toast({ title: 'Ошибка', description: 'Выберите группу', variant: 'destructive' })
      return
    }

    // Check if using demo user
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
      // Add category prefix to description
      const categoryPrefix = slotCategories[slotCategory].prefix
      const cleanDesc = getCleanDescription(description)
      let descriptionToSave: string | null = null

      if (cleanDesc && categoryPrefix) {
        // Если есть и описание, и категория - добавляем префикс
        descriptionToSave = `${categoryPrefix} ${cleanDesc}`
      } else if (cleanDesc) {
        // Если есть только описание, сохраняем как есть
        descriptionToSave = cleanDesc
      } else if (categoryPrefix) {
        // Если нет описания, но есть категория - сохраняем только префикс (без пробела)
        descriptionToSave = categoryPrefix
      }
      // Иначе оставляем NULL (не сохраняем пустые описания)

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
    
    // Логируем все слоты с тем же описанием, чтобы понять, что будет удалено
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
        // "Удалить все повторения" - удаляем ВСЕ слоты с этим описанием и временем на ВСЕ дни недели
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
          description: `Удалено ${allRepetitions.length} повторений на все дни недели`,
        })
      } else {
        // "Удалить этот день" - удаляем только слоты с теми же параметрами на этом дне недели
        if (slotToDelete.type === 'CYCLIC_WEEKLY' && slotToDelete.description) {
          const thisDayOfWeek = slotToDelete.dayOfWeek
          const thisDaySlots = slots.filter(
            s => s.type === 'CYCLIC_WEEKLY' 
              && s.description === slotToDelete.description
              && s.dayOfWeek === thisDayOfWeek
              && s.startTimeLocal === slotToDelete.startTimeLocal
              && s.endTimeLocal === slotToDelete.endTimeLocal
          )

          console.log(`🗑️ Deleting ${thisDaySlots.length} slots for this day (${daysOfWeek[jsDayToDisplayDay(thisDayOfWeek)]})`)

          for (const slot of thisDaySlots) {
            const response = await fetch(`/api/slots/${slot.id}`, { method: 'DELETE' })
            if (!response.ok) {
              console.error(`❌ Failed to delete slot ${slot.id}:`, response.status)
            } else {
              console.log(`✅ Deleted slot ${slot.id}`)
            }
          }

          toast({
            title: 'Успешно',
            description: `Удалено ${thisDaySlots.length} записей на ${daysOfWeek[jsDayToDisplayDay(thisDayOfWeek)]}`,
          })
        } else {
          // Одноразовый слот - просто удаляем по ID
          console.log(`🗑️ Deleting one-time slot: ${slotToDelete.id}`)
          const response = await fetch(`/api/slots/${slotToDelete.id}`, { method: 'DELETE' })
          
          if (!response.ok) {
            console.error('❌ Failed to delete slot:', response.status)
            throw new Error('Failed to delete slot')
          }
          
          console.log('✅ One-time slot deleted successfully')
          toast({ title: 'Успешно', description: 'Время удалено' })
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

  const renderCalendar = () => {
    const year = selectedDate.getFullYear()
    const month = selectedDate.getMonth()
    // Convert Sunday (0) to Monday-first week: Monday=0, Sunday=6
    const firstDay = (new Date(year, month, 1).getDay() + 6) % 7
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const today = new Date()

    const days = []

    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-10"></div>)
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day)
      const isToday = date.toDateString() === today.toDateString()
      const isSelected = date.toDateString() === selectedDate.toDateString()
      const busyness = getDayBusyness(date)
      const hasSlots = busyness > 0

      days.push(
        <button
          key={day}
          onClick={() => setSelectedDate(date)}
          className={`h-11 w-full rounded-lg flex items-center justify-center text-sm font-medium transition-all relative overflow-hidden
            ${isSelected ? 'bg-blue-500 text-white shadow-lg' : ''}
            ${!isSelected && hasSlots ? 'bg-gray-50' : ''}
            ${!isSelected && !hasSlots ? 'text-gray-600 hover:bg-gray-100' : ''}
            ${isToday && !isSelected ? 'ring-2 ring-blue-500' : ''}
          `}
        >
          {day}
          {renderGanttBars(date)}
        </button>
      )
    }

    return days
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

  const monthlySlots = getSlotsForDate(selectedDate)

  if (initializing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="max-w-4xl mx-auto p-4 pb-24">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">📅 TimeAgree</h1>
              <p className="text-gray-600">
                {user ? `Привет, ${user.firstName}!` : 'Загрузка...'}
              </p>
            </div>
          </div>
        </div>

        {/* Group Selector */}
        {groups.length > 0 && (
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="relative">
                <button
                  onClick={() => setGroupMenuOpen(!groupMenuOpen)}
                  className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
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
                    <div className="fixed inset-0 bg-black/20 z-10" onClick={() => setGroupMenuOpen(false)} />
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-xl border z-20 overflow-hidden">
                      {groups.map(group => (
                        <button
                          key={group.id}
                          onClick={() => {
                            setSelectedGroup(group)
                            setGroupMenuOpen(false)
                          }}
                          className={`w-full p-3 flex items-center gap-3 hover:bg-gray-50 transition ${
                            selectedGroup?.id === group.id ? 'bg-blue-50' : ''
                          }`}
                        >
                          <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                            {group.telegramTitle[0]}
                          </div>
                          <div className="text-left flex-1">
                            <div className="font-semibold text-gray-900">{group.telegramTitle}</div>
                            <div className="text-xs text-gray-500">{getParticipantsText(group.memberCount)}</div>
                          </div>
                          {selectedGroup?.id === group.id && (
                            <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                              <div className="w-2 h-2 bg-white rounded-full" />
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
          <TabsList className="grid w-full grid-cols-3 h-auto gap-1 p-1">
            <TabsTrigger value="slots" className="flex items-center gap-2 py-2.5 px-2">
              <Calendar className="w-4 h-4 flex-shrink-0" />
              <span className="text-xs font-medium truncate">Моё время</span>
            </TabsTrigger>
            <TabsTrigger value="find" className="flex items-center gap-2 py-2.5 px-2">
              <Clock className="w-4 h-4 flex-shrink-0" />
              <span className="text-xs font-medium truncate">Найти время</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2 py-2.5 px-2">
              <Settings className="w-4 h-4 flex-shrink-0" />
              <span className="text-xs font-medium truncate">Настройки</span>
            </TabsTrigger>
          </TabsList>

          {/* My Slots Tab */}
          <TabsContent value="slots" className="space-y-4">
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-lg">Календарь</CardTitle>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 flex-shrink-0"
                      onClick={() => {
                        const newDate = new Date(selectedDate)
                        newDate.setMonth(newDate.getMonth() - 1)
                        setSelectedDate(newDate)
                      }}
                    >
                      <span className="text-lg font-bold">←</span>
                    </Button>
                    <span className="text-sm font-medium px-2 whitespace-nowrap">
                      {selectedDate.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 flex-shrink-0"
                      onClick={() => {
                        const newDate = new Date(selectedDate)
                        newDate.setMonth(newDate.getMonth() + 1)
                        setSelectedDate(newDate)
                      }}
                    >
                      <span className="text-lg font-bold">→</span>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="grid grid-cols-7 mb-2">
                  {daysOfWeek.map(day => (
                    <div key={day} className="text-center text-xs font-semibold text-gray-500 py-2">
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                  {renderCalendar()}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>
                    Занятость на {selectedDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
                  </CardTitle>
                  <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="gap-2 h-9 px-4">
                        <Plus className="w-4 h-4 flex-shrink-0" />
                        <span className="text-sm">Добавить</span>
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px]">
                      <DialogHeader>
                        <DialogTitle>Добавить занятое время</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div>
                          <Label>Категория</Label>
                          <div className="grid grid-cols-5 gap-2 mt-2">
                            {(Object.keys(slotCategories) as SlotCategory[]).map((cat) => {
                              const catData = slotCategories[cat]
                              const Icon = catData.icon
                              return (
                                <button
                                  key={cat}
                                  onClick={() => setSlotCategory(cat)}
                                  className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition ${
                                    slotCategory === cat
                                      ? `${catData.bgColor} ${catData.borderColor} border-current`
                                      : 'bg-white border-gray-200 hover:border-gray-300'
                                  }`}
                                >
                                  <Icon className={`w-5 h-5 ${cat === slotCategory ? catData.textColor : 'text-gray-400'}`} />
                                  <span className={`text-xs font-medium ${cat === slotCategory ? catData.textColor : 'text-gray-500'}`}>
                                    {catData.label}
                                  </span>
                                </button>
                              )
                            })}
                          </div>
                        </div>

                        <div>
                          <Label>Описание</Label>
                          <Input
                            placeholder="Например: Работа, Встреча"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                          />
                        </div>

                        <div>
                          <Label>Тип</Label>
                          <Select value={slotType} onValueChange={(v: SlotType) => setSlotType(v)}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ONE_TIME">Одноразово</SelectItem>
                              <SelectItem value="CYCLIC_WEEKLY">Каждую неделю</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {slotType === 'ONE_TIME' ? (
                          <div>
                            <Label>Дата</Label>
                            <Input
                              type="date"
                              value={date}
                              onChange={(e) => setDate(e.target.value)}
                            />
                          </div>
                        ) : (
                          <div>
                            <Label className="mb-2 block">Дни недели</Label>
                            <div className="flex gap-1">
                              {[1, 2, 3, 4, 5, 6, 0].map(jsDay => (
                                <button
                                  key={jsDay}
                                  onClick={() => toggleDay(jsDay)}
                                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition border
                                    ${selectedDays.includes(jsDay)
                                      ? 'bg-blue-500 border-blue-400 text-white'
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
                            <Label>С</Label>
                            <Input
                              type="time"
                              value={startTime}
                              onChange={(e) => setStartTime(e.target.value)}
                            />
                          </div>
                          <div>
                            <Label>До</Label>
                            <Input
                              type="time"
                              value={endTime}
                              onChange={(e) => setEndTime(e.target.value)}
                            />
                          </div>
                        </div>

                        <Button
                          onClick={handleSaveSlot}
                          disabled={savingSlot}
                          className="w-full"
                        >
                          {savingSlot ? 'Сохранение...' : 'Сохранить'}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {monthlySlots.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    В этот день вы свободны ✨
                  </div>
                ) : (
                  <div className="space-y-2">
                    {monthlySlots.map(slot => {
                      const isCyclic = slot.type === 'CYCLIC_WEEKLY'
                      const category = getSlotCategory(slot.description)
                      const categoryData = slotCategories[category]
                      const Icon = categoryData.icon
                      const cleanDesc = getCleanDescription(slot.description)
                      const relatedCyclicCount = isCyclic && slot.description
                        ? slots.filter(s =>
                            s.type === 'CYCLIC_WEEKLY' &&
                            s.description === slot.description
                          ).length
                        : 0

                      return (
                        <div
                          key={slot.id}
                          className={`flex items-center justify-between p-3 rounded-lg border-2 ${categoryData.bgColor} ${categoryData.borderColor}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${categoryData.bgColor}`}>
                              <Icon className={`w-5 h-5 ${categoryData.textColor}`} />
                            </div>
                            <div>
                              <div className={`font-medium text-sm ${categoryData.textColor}`}>
                                {cleanDesc || (isCyclic ? 'Каждую неделю' : 'Разово')}
                                {isCyclic && relatedCyclicCount > 1 && (
                                  <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${categoryData.bgColor} ${categoryData.textColor}`}>
                                    {relatedCyclicCount} дн.
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500">
                                {slot.startTimeLocal} - {slot.endTimeLocal}
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDeleteDialog(slot)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            Удалить
                          </Button>
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
            <Card>
              <CardHeader>
                <CardTitle>Найти общее свободное время</CardTitle>
              </CardHeader>
              <CardContent>
                {!searchResults && !searching && (
                  <div className="text-center py-12">
                    <Users className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                    <p className="text-gray-600 mb-4">
                      Найдите общее свободное время с участниками группы
                    </p>
                    <p className="text-sm text-gray-500 mb-6">
                      Группа: {selectedGroup?.telegramTitle}
                    </p>
                    <Button
                      onClick={handleFindCommonTime}
                      className="gap-2"
                      size="lg"
                    >
                      <Search className="w-4 h-4" />
                      Найти свободное время
                    </Button>
                  </div>
                )}

                {searching && (
                  <div className="text-center py-12">
                    <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin text-blue-500" />
                    <p className="text-gray-600">Ищем пересечения...</p>
                  </div>
                )}

                {searchResults && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-600">
                        Найдено {searchResults.length} свободных слотов на ближайшие 7 дней
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSearchResults(null)
                          handleFindCommonTime()
                        }}
                      >
                        Новый поиск
                      </Button>
                    </div>

                    {searchResults.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        Свободное время не найдено. Попробуйте уменьшить минимальную длительность.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {searchResults.map((result, index) => {
                          const start = new Date(result.start)
                          const end = new Date(result.end)
                          return (
                            <div
                              key={index}
                              className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg"
                            >
                              <div>
                                <div className="font-semibold text-green-800">
                                  {start.toLocaleDateString('ru-RU', {
                                    weekday: 'short',
                                    day: 'numeric',
                                    month: 'short',
                                  })}
                                </div>
                                <div className="text-sm text-green-700">
                                  {start.toLocaleTimeString('ru-RU', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}{' '}
                                  —{' '}
                                  {end.toLocaleTimeString('ru-RU', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-medium text-green-800">
                                  {formatDuration(result.durationMinutes)}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Настройки</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    {user?.photoUrl ? (
                      <img src={user.photoUrl} alt={user.firstName} className="w-12 h-12 rounded-full" />
                    ) : (
                      <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                        {user?.firstName[0] || 'U'}
                      </div>
                    )}
                    <div>
                      <div className="font-medium">{user?.firstName} {user?.lastName}</div>
                      <div className="text-sm text-gray-500">@{user?.username}</div>
                    </div>
                  </div>
                </div>

                {/* Add Bot to Group Section */}
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start gap-3 mb-3">
                    <Users className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <h3 className="font-semibold text-blue-900 mb-1">Добавить бота в группу</h3>
                      <p className="text-sm text-blue-700">
                        Нажмите кнопку ниже, выберите группу и добавьте бота
                      </p>
                    </div>
                  </div>
                  <a
                    href="https://t.me/TimeAgreeBot?startgroup=true"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Добавить бота в группу</span>
                  </a>
                  <p className="text-xs text-blue-600 mt-3">
                    После добавления отправьте <kbd className="px-1.5 py-0.5 bg-blue-100 rounded">/start</kbd> в группе
                  </p>
                </div>

                <div className="space-y-2">
                  <h3 className="font-medium">Группы ({groups.length})</h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {groups.map(group => (
                      <div
                        key={group.id}
                        className="p-3 bg-gray-50 rounded-lg flex items-center gap-3"
                      >
                        <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                          {group.telegramTitle[0]}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">{group.telegramTitle}</div>
                          <div className="text-xs text-gray-500">{getParticipantsText(group.memberCount)}</div>
                        </div>
                        {group.tier === 'FREE' && (
                          <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full">Бесплатно</span>
                        )}
                      </div>
                    ))}
                    {groups.length === 0 && (
                      <div className="text-center py-6 text-gray-500 text-sm">
                        Вы пока не добавили бота ни в одну группу. Используйте кнопку выше, чтобы начать.
                      </div>
                    )}
                  </div>
                </div>

                {/* Database Cleanup Section */}
                <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="p-2 rounded-lg bg-orange-100">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-orange-900 mb-1">Очистка базы данных</h3>
                      <p className="text-sm text-orange-700">
                        Удалите неактивные группы и связанные данные
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      if (confirm('Вы уверены, что хотите удалить неактивные группы? Это действие нельзя отменить.')) {
                        try {
                          const response = await fetch('/api/cleanup', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              deleteInactiveGroups: true,
                              confirm: true,
                            }),
                          })
                          
                          if (response.ok) {
                            const data = await response.json()
                            toast({
                              title: 'Успешно',
                              description: data.message,
                            })
                            loadGroupData()
                          } else {
                            throw new Error('Failed to cleanup')
                          }
                        } catch (error) {
                          toast({
                            title: 'Ошибка',
                            description: 'Не удалось выполнить очистку',
                            variant: 'destructive',
                          })
                        }
                      }
                    }}
                    className="w-full"
                  >
                    Очистить неактивные группы
                  </Button>
                </div>

                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => {
                    localStorage.clear()
                    window.location.reload()
                  }}
                >
                  <LogOut className="w-4 h-4" />
                  Очистить кэш браузера
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Подтвердите удаление</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {slotToDelete && (
                <>
                  <p className="text-sm text-gray-600">
                    Вы хотите удалить запись:
                  </p>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="font-medium">
                      {slotToDelete.description ||
                        (slotToDelete.type === 'CYCLIC_WEEKLY' ? 'Каждую неделю' : 'Разово')}
                    </div>
                    <div className="text-sm text-gray-500">
                      {slotToDelete.startTimeLocal} - {slotToDelete.endTimeLocal}
                    </div>
                  </div>

                  {slotToDelete.type === 'CYCLIC_WEEKLY' && slotToDelete.description && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Выберите действие:</p>
                      <Button
                        onClick={() => handleConfirmDelete(true)}
                        disabled={deleteLoading}
                        variant="outline"
                        className="w-full justify-start border-red-200 hover:bg-red-50 hover:border-red-300"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-red-500"></div>
                          <div className="text-left">
                            <div className="font-medium text-red-700">Удалить все повторения</div>
                            <div className="text-xs text-red-600">
                              Удалить все {
                                slots.filter(s =>
                                  s.type === 'CYCLIC_WEEKLY' &&
                                  s.description === slotToDelete.description &&
                                  s.startTimeLocal === slotToDelete.startTimeLocal &&
                                  s.endTimeLocal === slotToDelete.endTimeLocal
                                ).length
                              } повторений на все дни недели
                            </div>
                          </div>
                        </div>
                      </Button>
                      <Button
                        onClick={() => handleConfirmDelete(false)}
                        disabled={deleteLoading}
                        variant="outline"
                        className="w-full justify-start"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                          <div className="text-left">
                            <div className="font-medium">Удалить только этот день</div>
                            <div className="text-xs text-gray-500">
                              Только на {daysOfWeek[jsDayToDisplayDay(slotToDelete.dayOfWeek || 0)]} ({
                                slots.filter(s =>
                                  s.type === 'CYCLIC_WEEKLY' &&
                                  s.description === slotToDelete.description &&
                                  s.dayOfWeek === slotToDelete.dayOfWeek &&
                                  s.startTimeLocal === slotToDelete.startTimeLocal &&
                                  s.endTimeLocal === slotToDelete.endTimeLocal
                                ).length
                              } записей)
                            </div>
                          </div>
                        </div>
                      </Button>
                    </div>
                  )}

                  {slotToDelete.type !== 'CYCLIC_WEEKLY' && (
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        onClick={() => setDeleteDialogOpen(false)}
                        disabled={deleteLoading}
                        className="flex-1"
                      >
                        Отмена
                      </Button>
                      <Button
                        onClick={() => handleConfirmDelete(false)}
                        disabled={deleteLoading}
                        variant="destructive"
                        className="flex-1"
                      >
                        {deleteLoading ? 'Удаление...' : 'Удалить'}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
