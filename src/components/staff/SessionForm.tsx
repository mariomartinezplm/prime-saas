import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Save,
    ChevronDown,
    ChevronUp,
    Activity,
    Ruler,
    Dumbbell,
    Zap,
    ClipboardCheck,
    AlertCircle,
    CheckCircle2,
    Plus,
    Trash2
} from "lucide-react";

// ─── Tipos ───────────────────────────────────────────────────────────────────
interface EVAData {
    painLevel: number;
    bodyArea: string;
    painType: string[];
    duration: string;
    worstTime: string;
    aggravatingFactors: string;
    relievingFactors: string;
    functionalImpact: number;
    medication: string;
    observations: string;
}

interface MeasurementData {
    weight: string;
    height: string;
    bodyFatPercentage: string;
    muscleMassPercentage: string;
    perimeters: {
        bicepLeft: string;
        bicepRight: string;
        chest: string;
        waist: string;
        hips: string;
        thighLeft: string;
        thighRight: string;
        calfLeft: string;
        calfRight: string;
        forearmLeft: string;
        forearmRight: string;
    };
}

interface ExerciseEntry {
    id: string;
    exerciseName: string;
    category: string;
    sets: string;
    reps: string;
    weight: string;
    rpe: string;
    techniqueRating: string;
    notes: string;
}

interface JumpData {
    verticalJump: string;
    horizontalJump: string;
    tripleJump: string;
    notes: string;
}

interface SOAPData {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
}

// ─── Constantes ──────────────────────────────────────────────────────────────
const bodyAreas = [
    { value: "cabeza", label: "Cabeza" },
    { value: "cuello", label: "Cuello" },
    { value: "hombro-izquierdo", label: "Hombro Izq." },
    { value: "hombro-derecho", label: "Hombro Der." },
    { value: "codo-izquierdo", label: "Codo Izq." },
    { value: "codo-derecho", label: "Codo Der." },
    { value: "espalda-alta", label: "Espalda Alta" },
    { value: "espalda-media", label: "Espalda Media" },
    { value: "espalda-baja", label: "Espalda Baja" },
    { value: "lumbar", label: "Lumbar" },
    { value: "cadera-izquierda", label: "Cadera Izq." },
    { value: "cadera-derecha", label: "Cadera Der." },
    { value: "rodilla-izquierda", label: "Rodilla Izq." },
    { value: "rodilla-derecha", label: "Rodilla Der." },
    { value: "tobillo-izquierdo", label: "Tobillo Izq." },
    { value: "tobillo-derecho", label: "Tobillo Der." },
    { value: "pecho", label: "Pecho" },
    { value: "abdomen", label: "Abdomen" },
    { value: "otro", label: "Otro" }
];

const painTypes = [
    "Agudo", "Punzante", "Sordo", "Pulsante", "Quemante",
    "Hormigueo", "Entumecimiento", "Rigidez", "Inflamación"
];

const exerciseCategories = [
    { value: "fuerza", label: "💪 Fuerza" },
    { value: "cardio", label: "🏃 Cardio" },
    { value: "flexibilidad", label: "🧘 Flexibilidad" },
    { value: "funcional", label: "⚙️ Funcional" },
    { value: "rehabilitacion", label: "🏥 Rehabilitación" }
];

// ─── Componente Principal ────────────────────────────────────────────────────
const SessionForm = ({ patientName, sessionType }: { patientName: string; sessionType: string }) => {
    // Secciones colapsables
    const [expandedSections, setExpandedSections] = useState({
        eva: true,
        measurements: false,
        exercises: true,
        jumps: false,
        soap: true
    });

    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    // ─── Estado EVA ──────────────────────────────────────────────────────
    const [evaData, setEvaData] = useState<EVAData>({
        painLevel: 0,
        bodyArea: "",
        painType: [],
        duration: "",
        worstTime: "",
        aggravatingFactors: "",
        relievingFactors: "",
        functionalImpact: 0,
        medication: "",
        observations: ""
    });

    // ─── Estado Medidas ──────────────────────────────────────────────────
    const [measurementData, setMeasurementData] = useState<MeasurementData>({
        weight: "",
        height: "",
        bodyFatPercentage: "",
        muscleMassPercentage: "",
        perimeters: {
            bicepLeft: "", bicepRight: "",
            chest: "", waist: "", hips: "",
            thighLeft: "", thighRight: "",
            calfLeft: "", calfRight: "",
            forearmLeft: "", forearmRight: ""
        }
    });

    // ─── Estado Ejercicios ───────────────────────────────────────────────
    const [exercises, setExercises] = useState<ExerciseEntry[]>([
        { id: "1", exerciseName: "", category: "fuerza", sets: "", reps: "", weight: "", rpe: "", techniqueRating: "", notes: "" }
    ]);

    // ─── Estado Saltos ───────────────────────────────────────────────────
    const [jumpData, setJumpData] = useState<JumpData>({
        verticalJump: "",
        horizontalJump: "",
        tripleJump: "",
        notes: ""
    });

    // ─── Estado SOAP ─────────────────────────────────────────────────────
    const [soapData, setSoapData] = useState<SOAPData>({
        subjective: "",
        objective: "",
        assessment: "",
        plan: ""
    });

    // ─── Helpers ─────────────────────────────────────────────────────────
    const toggleSection = (section: keyof typeof expandedSections) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const addExercise = () => {
        setExercises(prev => [...prev, {
            id: Date.now().toString(),
            exerciseName: "",
            category: "fuerza",
            sets: "", reps: "", weight: "", rpe: "", techniqueRating: "", notes: ""
        }]);
    };

    const removeExercise = (id: string) => {
        if (exercises.length > 1) {
            setExercises(prev => prev.filter(e => e.id !== id));
        }
    };

    const updateExercise = (id: string, field: keyof ExerciseEntry, value: string) => {
        setExercises(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));
    };

    const togglePainType = (type: string) => {
        setEvaData(prev => ({
            ...prev,
            painType: prev.painType.includes(type)
                ? prev.painType.filter(t => t !== type)
                : [...prev.painType, type]
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        // Simular guardado — aquí iría la llamada al API
        await new Promise(resolve => setTimeout(resolve, 1500));
        setSaving(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    };

    // ─── Calcular IMC ────────────────────────────────────────────────────
    const bmi = measurementData.weight && measurementData.height
        ? (parseFloat(measurementData.weight) / Math.pow(parseFloat(measurementData.height) / 100, 2)).toFixed(1)
        : null;

    return (
        <div className="space-y-4">
            {/* Header */}
            <Card className="p-4 bg-gradient-to-r from-teal-50 to-blue-50 border-teal-200">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-teal-800">
                            📋 Sesión Activa — {patientName}
                        </h3>
                        <p className="text-sm text-teal-600">
                            {new Date().toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                            {' • '}Tipo: <span className="font-semibold capitalize">{sessionType}</span>
                        </p>
                    </div>
                    <Button
                        onClick={handleSave}
                        disabled={saving}
                        className={`${saved ? 'bg-green-600 hover:bg-green-700' : 'bg-teal-600 hover:bg-teal-700'} text-white`}
                    >
                        {saving ? (
                            <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" /> Guardando...</>
                        ) : saved ? (
                            <><CheckCircle2 className="w-4 h-4 mr-2" /> ¡Guardado!</>
                        ) : (
                            <><Save className="w-4 h-4 mr-2" /> Guardar Sesión</>
                        )}
                    </Button>
                </div>
            </Card>

            {/* ═══════════════ SECCIÓN 1: EVA (Dolor) ═══════════════ */}
            <CollapsibleSection
                title="Evaluación del Dolor (EVA)"
                icon={<Activity className="w-5 h-5" />}
                expanded={expandedSections.eva}
                onToggle={() => toggleSection("eva")}
                color="red"
            >
                <div className="space-y-6">
                    {/* Escala de dolor visual */}
                    <div>
                        <label className="block text-sm font-semibold mb-3">
                            Nivel de Dolor (EVA 0-10): <span className="text-2xl ml-2">{evaData.painLevel}</span>
                        </label>
                        <div className="relative">
                            <input
                                type="range"
                                min="0"
                                max="10"
                                value={evaData.painLevel}
                                onChange={(e) => setEvaData(prev => ({ ...prev, painLevel: parseInt(e.target.value) }))}
                                className="w-full h-3 rounded-lg appearance-none cursor-pointer"
                                style={{
                                    background: `linear-gradient(to right, #22c55e 0%, #eab308 50%, #ef4444 100%)`
                                }}
                            />
                            <div className="flex justify-between text-xs text-gray-500 mt-1">
                                <span>0 Sin dolor</span>
                                <span>5 Moderado</span>
                                <span>10 Máximo</span>
                            </div>
                        </div>
                    </div>

                    {/* Zona corporal */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold mb-2">Zona Corporal</label>
                            <select
                                value={evaData.bodyArea}
                                onChange={(e) => setEvaData(prev => ({ ...prev, bodyArea: e.target.value }))}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-400 focus:border-teal-400"
                            >
                                <option value="">Seleccionar zona...</option>
                                {bodyAreas.map(area => (
                                    <option key={area.value} value={area.value}>{area.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold mb-2">Duración del Episodio</label>
                            <select
                                value={evaData.duration}
                                onChange={(e) => setEvaData(prev => ({ ...prev, duration: e.target.value }))}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-400 focus:border-teal-400"
                            >
                                <option value="">Seleccionar...</option>
                                <option value="agudo">Agudo (&lt; 6 semanas)</option>
                                <option value="subagudo">Subagudo (6-12 semanas)</option>
                                <option value="cronico">Crónico (&gt; 12 semanas)</option>
                            </select>
                        </div>
                    </div>

                    {/* Tipo de dolor */}
                    <div>
                        <label className="block text-sm font-semibold mb-2">Tipo de Dolor</label>
                        <div className="flex flex-wrap gap-2">
                            {painTypes.map(type => (
                                <button
                                    key={type}
                                    onClick={() => togglePainType(type)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${evaData.painType.includes(type)
                                            ? 'bg-red-100 text-red-700 border-2 border-red-400'
                                            : 'bg-gray-100 text-gray-600 border-2 border-gray-200 hover:border-red-300'
                                        }`}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Factores y impacto */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold mb-2">¿Peor momento del día?</label>
                            <select
                                value={evaData.worstTime}
                                onChange={(e) => setEvaData(prev => ({ ...prev, worstTime: e.target.value }))}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-400 focus:border-teal-400"
                            >
                                <option value="">Seleccionar...</option>
                                <option value="manana">Mañana</option>
                                <option value="tarde">Tarde</option>
                                <option value="noche">Noche</option>
                                <option value="constante">Constante</option>
                                <option value="variable">Variable</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold mb-2">
                                Impacto Funcional: <span className="text-lg">{evaData.functionalImpact}/10</span>
                            </label>
                            <input
                                type="range"
                                min="0"
                                max="10"
                                value={evaData.functionalImpact}
                                onChange={(e) => setEvaData(prev => ({ ...prev, functionalImpact: parseInt(e.target.value) }))}
                                className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-gray-200"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold mb-2">Factores que empeoran</label>
                            <Input
                                value={evaData.aggravatingFactors}
                                onChange={(e) => setEvaData(prev => ({ ...prev, aggravatingFactors: e.target.value }))}
                                placeholder="Ej: caminar, subir escaleras..."
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold mb-2">Factores que alivian</label>
                            <Input
                                value={evaData.relievingFactors}
                                onChange={(e) => setEvaData(prev => ({ ...prev, relievingFactors: e.target.value }))}
                                placeholder="Ej: reposo, hielo..."
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold mb-2">Medicación Actual</label>
                        <Input
                            value={evaData.medication}
                            onChange={(e) => setEvaData(prev => ({ ...prev, medication: e.target.value }))}
                            placeholder="Ej: Ibuprofeno 400mg c/8h"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold mb-2">Observaciones</label>
                        <Textarea
                            value={evaData.observations}
                            onChange={(e) => setEvaData(prev => ({ ...prev, observations: e.target.value }))}
                            placeholder="Observaciones adicionales sobre el dolor..."
                            rows={3}
                        />
                    </div>
                </div>
            </CollapsibleSection>

            {/* ═══════════════ SECCIÓN 2: MEDIDAS ═══════════════ */}
            <CollapsibleSection
                title="Medidas y Antropometría"
                icon={<Ruler className="w-5 h-5" />}
                expanded={expandedSections.measurements}
                onToggle={() => toggleSection("measurements")}
                color="blue"
            >
                <div className="space-y-6">
                    {/* Medidas generales */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <NumberField label="Peso (kg)" value={measurementData.weight}
                            onChange={(v) => setMeasurementData(prev => ({ ...prev, weight: v }))} />
                        <NumberField label="Altura (cm)" value={measurementData.height}
                            onChange={(v) => setMeasurementData(prev => ({ ...prev, height: v }))} />
                        <NumberField label="% Grasa Corporal" value={measurementData.bodyFatPercentage}
                            onChange={(v) => setMeasurementData(prev => ({ ...prev, bodyFatPercentage: v }))} />
                        <NumberField label="% Masa Muscular" value={measurementData.muscleMassPercentage}
                            onChange={(v) => setMeasurementData(prev => ({ ...prev, muscleMassPercentage: v }))} />
                    </div>

                    {bmi && (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2">
                            <span className="text-sm font-semibold text-blue-700">IMC Calculado:</span>
                            <span className="text-lg font-bold text-blue-800">{bmi}</span>
                            <span className="text-xs text-blue-600 ml-2">
                                {parseFloat(bmi) < 18.5 ? '(Bajo peso)' :
                                    parseFloat(bmi) < 25 ? '(Normal)' :
                                        parseFloat(bmi) < 30 ? '(Sobrepeso)' : '(Obesidad)'}
                            </span>
                        </div>
                    )}

                    {/* Perímetros */}
                    <div>
                        <h4 className="font-semibold text-sm mb-3 text-blue-700">📏 Perímetros Corporales (cm)</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {[
                                { key: "bicepLeft", label: "Bícep Izq." },
                                { key: "bicepRight", label: "Bícep Der." },
                                { key: "forearmLeft", label: "Antebrazo Izq." },
                                { key: "forearmRight", label: "Antebrazo Der." },
                                { key: "chest", label: "Pecho" },
                                { key: "waist", label: "Cintura" },
                                { key: "hips", label: "Cadera" },
                                { key: "thighLeft", label: "Muslo Izq." },
                                { key: "thighRight", label: "Muslo Der." },
                                { key: "calfLeft", label: "Pantorrilla Izq." },
                                { key: "calfRight", label: "Pantorrilla Der." }
                            ].map(({ key, label }) => (
                                <NumberField
                                    key={key}
                                    label={label}
                                    value={measurementData.perimeters[key as keyof typeof measurementData.perimeters]}
                                    onChange={(v) => setMeasurementData(prev => ({
                                        ...prev,
                                        perimeters: { ...prev.perimeters, [key]: v }
                                    }))}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </CollapsibleSection>

            {/* ═══════════════ SECCIÓN 3: EJERCICIOS ═══════════════ */}
            <CollapsibleSection
                title={`Ejercicios Realizados (${exercises.filter(e => e.exerciseName).length})`}
                icon={<Dumbbell className="w-5 h-5" />}
                expanded={expandedSections.exercises}
                onToggle={() => toggleSection("exercises")}
                color="green"
            >
                <div className="space-y-4">
                    {exercises.map((exercise, index) => (
                        <div key={exercise.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200 relative">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-sm font-bold text-gray-600">Ejercicio #{index + 1}</span>
                                {exercises.length > 1 && (
                                    <button
                                        onClick={() => removeExercise(exercise.id)}
                                        className="text-red-400 hover:text-red-600 transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                <div className="col-span-2 md:col-span-1">
                                    <label className="block text-xs font-medium mb-1 text-gray-600">Nombre del Ejercicio</label>
                                    <Input
                                        value={exercise.exerciseName}
                                        onChange={(e) => updateExercise(exercise.id, 'exerciseName', e.target.value)}
                                        placeholder="Ej: Sentadilla"
                                        className="text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1 text-gray-600">Categoría</label>
                                    <select
                                        value={exercise.category}
                                        onChange={(e) => updateExercise(exercise.id, 'category', e.target.value)}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-400"
                                    >
                                        {exerciseCategories.map(cat => (
                                            <option key={cat.value} value={cat.value}>{cat.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <NumberField label="Series" value={exercise.sets}
                                    onChange={(v) => updateExercise(exercise.id, 'sets', v)} small />
                                <NumberField label="Repeticiones" value={exercise.reps}
                                    onChange={(v) => updateExercise(exercise.id, 'reps', v)} small />
                                <NumberField label="Peso (kg)" value={exercise.weight}
                                    onChange={(v) => updateExercise(exercise.id, 'weight', v)} small />
                                <NumberField label="RPE (1-10)" value={exercise.rpe}
                                    onChange={(v) => updateExercise(exercise.id, 'rpe', v)} small />
                                <NumberField label="Técnica (1-5)" value={exercise.techniqueRating}
                                    onChange={(v) => updateExercise(exercise.id, 'techniqueRating', v)} small />

                                <div className="col-span-2 md:col-span-1">
                                    <label className="block text-xs font-medium mb-1 text-gray-600">Notas</label>
                                    <Input
                                        value={exercise.notes}
                                        onChange={(e) => updateExercise(exercise.id, 'notes', e.target.value)}
                                        placeholder="Observaciones..."
                                        className="text-sm"
                                    />
                                </div>
                            </div>

                            {/* 1RM calculado */}
                            {exercise.weight && exercise.reps && parseInt(exercise.reps) > 0 && parseInt(exercise.reps) <= 12 && (
                                <div className="mt-2 text-xs text-green-600 font-medium">
                                    1RM estimado: {(parseFloat(exercise.weight) * (1 + parseInt(exercise.reps) / 30)).toFixed(1)} kg (Fórmula Epley)
                                </div>
                            )}
                        </div>
                    ))}

                    <Button onClick={addExercise} variant="outline" size="sm" className="w-full border-dashed border-2">
                        <Plus className="w-4 h-4 mr-2" /> Agregar Ejercicio
                    </Button>
                </div>
            </CollapsibleSection>

            {/* ═══════════════ SECCIÓN 4: SALTOS ═══════════════ */}
            <CollapsibleSection
                title="Tests de Salto (Potencia)"
                icon={<Zap className="w-5 h-5" />}
                expanded={expandedSections.jumps}
                onToggle={() => toggleSection("jumps")}
                color="purple"
            >
                <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                        <NumberField label="Salto Vertical (cm)" value={jumpData.verticalJump}
                            onChange={(v) => setJumpData(prev => ({ ...prev, verticalJump: v }))} />
                        <NumberField label="Salto Horizontal (cm)" value={jumpData.horizontalJump}
                            onChange={(v) => setJumpData(prev => ({ ...prev, horizontalJump: v }))} />
                        <NumberField label="Triple Salto (cm)" value={jumpData.tripleJump}
                            onChange={(v) => setJumpData(prev => ({ ...prev, tripleJump: v }))} />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold mb-2">Observaciones del Test</label>
                        <Textarea
                            value={jumpData.notes}
                            onChange={(e) => setJumpData(prev => ({ ...prev, notes: e.target.value }))}
                            placeholder="Técnica de aterrizaje, asimetrías observadas..."
                            rows={2}
                        />
                    </div>
                </div>
            </CollapsibleSection>

            {/* ═══════════════ SECCIÓN 5: SOAP ═══════════════ */}
            <CollapsibleSection
                title="Nota SOAP"
                icon={<ClipboardCheck className="w-5 h-5" />}
                expanded={expandedSections.soap}
                onToggle={() => toggleSection("soap")}
                color="teal"
            >
                <div className="space-y-4">
                    {[
                        { key: "subjective", label: "S — Subjetivo", placeholder: "Lo que el paciente refiere...", color: "blue" },
                        { key: "objective", label: "O — Objetivo", placeholder: "Lo que observas y mides...", color: "green" },
                        { key: "assessment", label: "A — Análisis", placeholder: "Tu interpretación clínica...", color: "yellow" },
                        { key: "plan", label: "P — Plan", placeholder: "Qué harás a continuación...", color: "purple" }
                    ].map(({ key, label, placeholder, color }) => (
                        <div key={key}>
                            <label className={`block text-sm font-bold mb-1 text-${color}-700`}>{label}</label>
                            <Textarea
                                value={soapData[key as keyof SOAPData]}
                                onChange={(e) => setSoapData(prev => ({ ...prev, [key]: e.target.value }))}
                                placeholder={placeholder}
                                rows={3}
                                className="resize-none"
                            />
                        </div>
                    ))}
                </div>
            </CollapsibleSection>

            {/* Botón guardar final */}
            <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline">Cancelar</Button>
                <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-teal-600 hover:bg-teal-700 text-white px-8"
                >
                    {saving ? (
                        <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" /> Guardando...</>
                    ) : (
                        <><Save className="w-4 h-4 mr-2" /> Guardar Toda la Sesión</>
                    )}
                </Button>
            </div>
        </div>
    );
};

// ─── Componente Sección Colapsable ───────────────────────────────────────────
const CollapsibleSection = ({ title, icon, expanded, onToggle, color, children }: any) => {
    const colorClasses: Record<string, string> = {
        red: "border-red-200 bg-red-50/50",
        blue: "border-blue-200 bg-blue-50/50",
        green: "border-green-200 bg-green-50/50",
        purple: "border-purple-200 bg-purple-50/50",
        teal: "border-teal-200 bg-teal-50/50"
    };
    const headerColors: Record<string, string> = {
        red: "text-red-700",
        blue: "text-blue-700",
        green: "text-green-700",
        purple: "text-purple-700",
        teal: "text-teal-700"
    };

    return (
        <Card className={`border-2 ${expanded ? colorClasses[color] : 'border-gray-200'} transition-all`}>
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50/50 transition-colors"
            >
                <div className={`flex items-center gap-3 ${headerColors[color]} font-semibold`}>
                    {icon}
                    <span>{title}</span>
                </div>
                {expanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </button>
            {expanded && (
                <div className="px-4 pb-4 border-t border-gray-200 pt-4">
                    {children}
                </div>
            )}
        </Card>
    );
};

// ─── Componente Campo Numérico ───────────────────────────────────────────────
const NumberField = ({ label, value, onChange, small }: { label: string; value: string; onChange: (v: string) => void; small?: boolean }) => (
    <div>
        <label className={`block ${small ? 'text-xs' : 'text-sm'} font-medium mb-1 text-gray-600`}>{label}</label>
        <Input
            type="number"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="—"
            className={`${small ? 'text-sm' : ''}`}
        />
    </div>
);

export default SessionForm;
