'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Trash2, Loader2, Building2, BookOpen, Dumbbell, Gamepad2, Clock } from 'lucide-react'
import { toast } from '@/hooks/use-toast'

type SlotType = 'ONE_TIME' | 'CYCLIC_WEEKLY'
type SlotCategory = 'work' | 'study' | 'sport' | 'leisure' | 'other'

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

interface DaySlotSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedDate: Date | null
  slots: Slot[]
  userId: string | null
  userTimezone?: string
  onSlotsChange?: () => void
}

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

const daysOfWeekFull = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота']

const getSlotCategory = (desc?: string): SlotCategory => {
  if (!desc) return 'other'
  if (desc.includes('🏢')) return 'work'
  if (desc.includes('📚')) return 'study'
  if (desc.includes('🏃')) return 'sport'
  if (desc.includes('🎮')) return 'leisure'
  return 'other'
}

const getCleanDescription = (desc?: string): string => {
  if (!desc) return ''
  return desc.replace(/[^\p{L}\p{N}\s\.,;:!?@%$&*()_+=\-\[\]{}'"`<>`~`^|/\\]/gu, '').trim()
}

export function DaySlotSheet({
  open,
  onOpenChange,
  selectedDate,
  slots,
  userId,
  userTimezone,
  onSlotsChange
}: DaySlotSheetProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [editingSlot, setEditingSlot] = useState<Slot | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Slot | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Form state
  const [title, setTitle] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('18:00')
  const [category, setCategory] = useState<SlotCategory>('other')

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('ru-RU', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  // Get slots for the selected date
  const getSlotsForDate = () => {
    if (!selectedDate) return []
    const dateStr = selectedDate.toISOString().split('T')[0]
    
    return slots.filter(slot => {
      if (slot.type === 'ONE_TIME' && slot.startAt) {
        const slotDateStr = new Date(slot.startAt).toISOString().split('T')[0]
        return slotDateStr === dateStr
      }
      if (slot.type === 'CYCLIC_WEEKLY' && slot.dayOfWeek !== undefined) {
        return slot.dayOfWeek === selectedDate.getDay()
      }
      return false
    })
  }

  const daySlots = getSlotsForDate()

  const resetForm = () => {
    setTitle('')
    setStartTime('09:00')
    setEndTime('18:00')
    setCategory('other')
    setEditingSlot(null)
    setIsAdding(false)
  }

  const handleAddSlot = () => {
    setIsAdding(true)
    setEditingSlot(null)
    setTitle('')
    setStartTime('09:00')
    setEndTime('18:00')
    setCategory('other')
  }

  const handleEditSlot = (slot: Slot) => {
    setEditingSlot(slot)
    setIsAdding(true)
    setTitle(getCleanDescription(slot.description))
    setStartTime(slot.startTimeLocal || '09:00')
    setEndTime(slot.endTimeLocal || '18:00')
    setCategory(getSlotCategory(slot.description))
  }

  const handleDeleteSlot = async (slot: Slot) => {
    if (!userId || userId === 'demo-user') {
      toast({
        title: 'Демо режим',
        description: 'В демо режиме нельзя удалять слоты',
        variant: 'destructive'
      })
      return
    }

    setDeleting(true)
    try {
      const response = await fetch(`/api/slots/${slot.id}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        toast({ title: 'Удалено', description: 'Слот успешно удалён' })
        onSlotsChange?.()
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
      setDeleting(false)
      setDeleteConfirm(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedDate || !userId || userId === 'demo-user') {
      toast({
        title: 'Ошибка',
        description: 'Необходимо авторизоваться',
        variant: 'destructive'
      })
      return
    }

    // Validate times
    const [startH, startM] = startTime.split(':').map(Number)
    const [endH, endM] = endTime.split(':').map(Number)
    
    if (startH * 60 + startM >= endH * 60 + endM) {
      toast({
        title: 'Ошибка',
        description: 'Время окончания должно быть позже начала',
        variant: 'destructive'
      })
      return
    }

    setSaving(true)

    try {
      const categoryPrefix = slotCategories[category].prefix
      const description = categoryPrefix 
        ? (title ? `${categoryPrefix} ${title}` : categoryPrefix)
        : title

      // Get timezone from user settings
      const slotTimezone = userTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone

      if (editingSlot) {
        // Delete old slot first
        await fetch(`/api/slots/${editingSlot.id}`, { method: 'DELETE' })
      }

      // Create new slot
      const dateStr = selectedDate.toISOString().split('T')[0]
      const startAt = new Date(`${dateStr}T${startTime}:00`)
      const endAt = new Date(`${dateStr}T${endTime}:00`)

      const response = await fetch('/api/slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          type: 'ONE_TIME',
          description: description || null,
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          startTimeLocal: startTime,
          endTimeLocal: endTime,
          timezone: slotTimezone,
        })
      })

      if (response.ok) {
        toast({
          title: editingSlot ? 'Обновлено' : 'Создано',
          description: editingSlot ? 'Слот успешно обновлён' : 'Слот успешно создан'
        })
        resetForm()
        onSlotsChange?.()
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Не удалось сохранить')
      }
    } catch (error: any) {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось сохранить слот',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) resetForm()
      }}>
        <SheetContent side="bottom" className="h-[85vh] flex flex-col">
          <SheetHeader className="shrink-0">
            <SheetTitle>
              {selectedDate ? formatDate(selectedDate) : 'Выберите день'}
            </SheetTitle>
            <SheetDescription>
              {daySlots.length > 0 
                ? `${daySlots.length} ${daySlots.length === 1 ? 'событие' : daySlots.length < 5 ? 'события' : 'событий'}`
                : 'Нет событий на этот день'
              }
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto py-4">
            {!isAdding && daySlots.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Нет событий на этот день</p>
                <p className="text-sm mt-1">Нажмите + чтобы добавить</p>
              </div>
            )}

            {!isAdding && daySlots.length > 0 && (
              <div className="space-y-2">
                {daySlots.map(slot => {
                  const cat = getSlotCategory(slot.description)
                  const catInfo = slotCategories[cat]
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
                              {slot.startTimeLocal} - {slot.endTimeLocal}
                            </span>
                            <Badge variant="secondary" className={`text-xs ${catInfo.textColor}`}>
                              {catInfo.label}
                            </Badge>
                            {slot.type === 'CYCLIC_WEEKLY' && (
                              <Badge variant="outline" className="text-xs">
                                Каждую неделю
                              </Badge>
                            )}
                          </div>
                          {cleanDesc && (
                            <p className="text-sm text-muted-foreground">{cleanDesc}</p>
                          )}
                          {slot.timezone && slot.timezone !== 'UTC' && (
                            <p className="text-xs text-muted-foreground mt-1">
                              ({slot.timezone})
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleEditSlot(slot)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteConfirm(slot)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {isAdding && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Название</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Что запланировано?"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="startTime">Начало</Label>
                    <Input
                      id="startTime"
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endTime">Конец</Label>
                    <Input
                      id="endTime"
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Категория</Label>
                  <Select value={category} onValueChange={(v) => setCategory(v as SlotCategory)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(slotCategories).map(([key, value]) => (
                        <SelectItem key={key} value={key}>
                          <div className="flex items-center gap-2">
                            <span>{value.prefix}</span>
                            <span>{value.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Timezone info */}
                <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
                  Часовой пояс: <span className="font-medium">{userTimezone || 'UTC'}</span>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={resetForm}
                  >
                    Отмена
                  </Button>
                  <Button type="submit" className="flex-1" disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    {editingSlot ? 'Сохранить' : 'Добавить'}
                  </Button>
                </div>
              </form>
            )}
          </div>

          {!isAdding && (
            <div className="shrink-0 pt-4 border-t">
              <Button onClick={handleAddSlot} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Добавить событие
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={!!deleteConfirm} onOpenChange={(o) => !o && setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить событие?</DialogTitle>
            <DialogDescription>
              Это действие нельзя отменить. Событие будет удалено навсегда.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Отмена
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && handleDeleteSlot(deleteConfirm)}
              disabled={deleting}
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Удалить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
