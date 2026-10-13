import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { CommercialRequest } from './commercial-request.entity.js';

export type HistoryEventType = 'CREACION' | 'ESTADO' | 'ASIGNACION';

@Entity('solicitudes_historial')
@Index(['solicitud'])
@Index(['fechaEvento'])
export class RequestHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => CommercialRequest, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'solicitud_id' })
  solicitud: CommercialRequest;

  @Column()
  solicitudId: number;

  @Column()
  tipoEvento: HistoryEventType;

  @Column({ nullable: true })
  valorAnterior: string | null;

  @Column()
  valorNuevo: string;

  @Column()
  usuarioActor: string;

  @CreateDateColumn({ type: 'timestamptz' })
  fechaEvento: Date;
}
