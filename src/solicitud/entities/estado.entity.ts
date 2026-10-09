import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';



@Entity('estados')
export class Estado {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  nombre: string;

  @Column({ unique: true })
  orden: number;
}
